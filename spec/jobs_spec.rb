require_relative 'spec_helper'
require 'oxidized/jobs'

describe Oxidized::Jobs do
  before(:each) do
    Oxidized.asetus = Asetus.new
    Oxidized.config.threads = 4
    Oxidized.config.use_max_threads = false
    Oxidized.config.interval = 3600

    Oxidized::Node.any_instance.stubs(:resolve_repo)
    Oxidized::Node.any_instance.stubs(:resolve_output)

    @node_opts = {
      input:    'ssh',
      output:   'git',
      model:    'junos',
      username: 'test_user',
      password: 'test_pass',
      prompt:   'test_prompt'
    }

    @nodes = Oxidized::Nodes.new(nodes: [
      Oxidized::Node.new(@node_opts.merge(name: 'node1.example.com')),
      Oxidized::Node.new(@node_opts.merge(name: 'node2.example.com')),
      Oxidized::Node.new(@node_opts.merge(name: 'node3.example.com'))
    ])
  end

  describe '#initialize' do
    it 'creates jobs with correct max threads' do
      jobs = Oxidized::Jobs.new(4, false, 3600, @nodes)
      _(jobs.max).must_equal 4
    end

    it 'sets interval correctly' do
      jobs = Oxidized::Jobs.new(4, false, 3600, @nodes)
      _(jobs.interval).must_equal 3600
    end

    it 'sets interval to 1 when disabled (zero)' do
      jobs = Oxidized::Jobs.new(4, false, 0, @nodes)
      _(jobs.interval).must_equal 1
    end

    it 'initializes with empty array' do
      jobs = Oxidized::Jobs.new(4, false, 3600, @nodes)
      _(jobs.size).must_equal 0
    end

    it 'calculates initial want value' do
      jobs = Oxidized::Jobs.new(4, false, 3600, @nodes)
      _(jobs.want).must_be :>=, 1
    end
  end

  describe '#push' do
    it 'adds a job to the array' do
      jobs = Oxidized::Jobs.new(4, false, 3600, @nodes)
      job = mock('job')

      jobs.push(job)
      _(jobs.size).must_equal 1
    end

    it 'updates last timestamp when pushing' do
      jobs = Oxidized::Jobs.new(4, false, 3600, @nodes)
      job = mock('job')

      before_time = Time.now.utc
      jobs.push(job)
      after_time = Time.now.utc

      last = jobs.instance_variable_get(:@last)
      _(last).must_be :>=, before_time
      _(last).must_be :<=, after_time
    end
  end

  describe '#duration' do
    it 'updates rolling average duration' do
      jobs = Oxidized::Jobs.new(4, false, 3600, @nodes)

      jobs.duration(10)
      duration = jobs.instance_variable_get(:@duration)
      _(duration).must_be :>, 0
    end

    it 'recalculates want after duration update' do
      jobs = Oxidized::Jobs.new(4, false, 3600, @nodes)
      initial_want = jobs.want

      jobs.duration(100)
      _(jobs.want).must_be :>=, 1
    end

    it 'handles duration array size changes' do
      jobs = Oxidized::Jobs.new(4, false, 3600, @nodes)

      10.times { jobs.duration(5) }

      durations = jobs.instance_variable_get(:@durations)
      _(durations.size).must_equal @nodes.size
    end
  end

  describe '#new_count' do
    it 'sets want to max when use_max_threads is true' do
      jobs = Oxidized::Jobs.new(4, true, 3600, @nodes)
      jobs.new_count
      _(jobs.want).must_equal 4
    end

    it 'calculates want based on duration and interval' do
      jobs = Oxidized::Jobs.new(10, false, 3600, @nodes)
      jobs.new_count
      _(jobs.want).must_be :>=, 1
      _(jobs.want).must_be :<=, @nodes.size
    end

    it 'ensures want is at least 1' do
      jobs = Oxidized::Jobs.new(4, false, 3600, @nodes)
      jobs.instance_variable_set(:@duration, 0.001)
      jobs.new_count
      _(jobs.want).must_be :>=, 1
    end

    it 'caps want at node count' do
      jobs = Oxidized::Jobs.new(100, false, 1, @nodes)
      jobs.instance_variable_set(:@duration, 1000)
      jobs.new_count
      _(jobs.want).must_be :<=, @nodes.size
    end

    it 'caps want at max threads' do
      jobs = Oxidized::Jobs.new(2, false, 1, @nodes)
      jobs.instance_variable_set(:@duration, 1000)
      jobs.new_count
      _(jobs.want).must_be :<=, 2
    end
  end

  describe '#increment' do
    it 'increments want by 1' do
      jobs = Oxidized::Jobs.new(4, false, 3600, @nodes)
      jobs.instance_variable_set(:@want, 1)

      jobs.increment
      _(jobs.want).must_equal 2
    end

    it 'does not exceed node count' do
      jobs = Oxidized::Jobs.new(10, false, 3600, @nodes)
      jobs.instance_variable_set(:@want, 3)

      jobs.increment
      _(jobs.want).must_be :<=, @nodes.size
    end

    it 'does not exceed max threads' do
      jobs = Oxidized::Jobs.new(2, false, 3600, @nodes)
      jobs.instance_variable_set(:@want, 2)

      jobs.increment
      _(jobs.want).must_be :<=, 2
    end
  end

  describe '#work' do
    it 'does not increment when want exceeds current size' do
      jobs = Oxidized::Jobs.new(4, false, 3600, @nodes)
      jobs.instance_variable_set(:@want, 2)
      initial_want = jobs.want

      jobs.work
      _(jobs.want).must_equal initial_want
    end

    it 'increments when gap exceeds MAX_INTER_JOB_GAP' do
      jobs = Oxidized::Jobs.new(4, false, 3600, @nodes)
      jobs.instance_variable_set(:@want, 1)
      jobs.instance_variable_set(:@last, Time.now.utc - 400)

      job = mock('job')
      jobs.push(job)

      jobs.work
      _(jobs.want).must_be :>=, 1
    end
  end

  describe 'AVERAGE_DURATION constant' do
    it 'has a default average duration of 5 seconds' do
      _(Oxidized::Jobs::AVERAGE_DURATION).must_equal 5
    end
  end

  describe 'MAX_INTER_JOB_GAP constant' do
    it 'has a max inter job gap of 300 seconds' do
      _(Oxidized::Jobs::MAX_INTER_JOB_GAP).must_equal 300
    end
  end
end
