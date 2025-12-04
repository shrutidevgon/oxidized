require_relative 'spec_helper'
require 'oxidized/worker'

describe Oxidized::Worker do
  before(:each) do
    Oxidized.asetus = Asetus.new
    Oxidized.config.threads = 2
    Oxidized.config.use_max_threads = false
    Oxidized.config.interval = 3600
    Oxidized.config.retries = 3
    Oxidized.config.timelimit = 300
    Oxidized.config.run_once = false

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
  end

  describe '#initialize' do
    it 'creates a worker with nodes and jobs' do
      nodes = Oxidized::Nodes.new(nodes: [
        Oxidized::Node.new(@node_opts.merge(name: 'node1.example.com'))
      ])

      worker = Oxidized::Worker.new(nodes)
      _(worker).wont_be_nil
    end

    it 'sets jobs_done to zero initially' do
      nodes = Oxidized::Nodes.new(nodes: [
        Oxidized::Node.new(@node_opts.merge(name: 'node1.example.com'))
      ])

      worker = Oxidized::Worker.new(nodes)
      _(worker.instance_variable_get(:@jobs_done)).must_equal 0
    end
  end

  describe '#reload' do
    it 'calls load on nodes' do
      nodes = Oxidized::Nodes.new(nodes: [
        Oxidized::Node.new(@node_opts.merge(name: 'node1.example.com'))
      ])

      worker = Oxidized::Worker.new(nodes)
      nodes.expects(:load)
      worker.reload
    end
  end

  describe '#process' do
    before(:each) do
      @node = Oxidized::Node.new(@node_opts.merge(name: 'test-node.example.com'))
      @nodes = Oxidized::Nodes.new(nodes: [@node])
      @worker = Oxidized::Worker.new(@nodes)

      Oxidized.stubs(:hooks).returns(stub(handle: true))
    end

    it 'processes a successful job' do
      job = mock('Oxidized::Job')
      job.stubs(:node).returns(@node)
      job.stubs(:status).returns(:success)
      job.stubs(:time).returns(5.0)
      job.stubs(:config).returns('test config')

      output_instance = mock('output_instance')
      output_instance.stubs(:store).returns(true)
      output_instance.stubs(:commitref).returns('abc123')

      output_class = mock('output_class')
      output_class.stubs(:new).returns(output_instance)
      @node.stubs(:output).returns(output_class)

      @worker.process(job)

      _(@node.running).must_equal false
      _(@node.last).wont_be_nil
    end

    it 'processes a failed job and increments retry' do
      job = mock('Oxidized::Job')
      job.stubs(:node).returns(@node)
      job.stubs(:status).returns(:fail)
      job.stubs(:time).returns(5.0)

      @node.retry = 0

      Oxidized::Worker.logger.expects(:warn).with(regexp_matches(/retry attempt 1/))

      @worker.process(job)

      _(@node.retry).must_equal 1
      _(@node.running).must_equal false
    end

    it 'gives up after retries exhausted' do
      job = mock('Oxidized::Job')
      job.stubs(:node).returns(@node)
      job.stubs(:status).returns(:fail)
      job.stubs(:time).returns(5.0)

      @node.retry = 3

      Oxidized::Worker.logger.expects(:warn).with(regexp_matches(/retries exhausted/))

      @worker.process(job)

      _(@node.retry).must_equal 0
      _(@node.running).must_equal false
    end
  end

  describe '#cycle_finished?' do
    it 'returns true when jobs_done exceeds node count' do
      nodes = Oxidized::Nodes.new(nodes: [
        Oxidized::Node.new(@node_opts.merge(name: 'node1.example.com'))
      ])

      worker = Oxidized::Worker.new(nodes)
      worker.instance_variable_set(:@jobs_done, 2)

      _(worker.send(:cycle_finished?)).must_equal true
    end

    it 'returns true when jobs_done equals node count' do
      nodes = Oxidized::Nodes.new(nodes: [
        Oxidized::Node.new(@node_opts.merge(name: 'node1.example.com'))
      ])

      worker = Oxidized::Worker.new(nodes)
      worker.instance_variable_set(:@jobs_done, 1)

      _(worker.send(:cycle_finished?)).must_equal true
    end

    it 'returns false when jobs_done is zero' do
      nodes = Oxidized::Nodes.new(nodes: [
        Oxidized::Node.new(@node_opts.merge(name: 'node1.example.com'))
      ])

      worker = Oxidized::Worker.new(nodes)
      worker.instance_variable_set(:@jobs_done, 0)

      _(worker.send(:cycle_finished?)).must_equal false
    end
  end

  describe '#run_done_hook' do
    it 'handles hook and resets jobs_done' do
      nodes = Oxidized::Nodes.new(nodes: [
        Oxidized::Node.new(@node_opts.merge(name: 'node1.example.com'))
      ])

      worker = Oxidized::Worker.new(nodes)
      worker.instance_variable_set(:@jobs_done, 5)

      hooks = mock('hooks')
      hooks.expects(:handle).with(:nodes_done)
      Oxidized.stubs(:hooks).returns(hooks)

      worker.send(:run_done_hook)

      _(worker.instance_variable_get(:@jobs_done)).must_equal 0
    end

    it 'catches and logs hook errors' do
      nodes = Oxidized::Nodes.new(nodes: [
        Oxidized::Node.new(@node_opts.merge(name: 'node1.example.com'))
      ])

      worker = Oxidized::Worker.new(nodes)
      worker.instance_variable_set(:@jobs_done, 5)

      hooks = mock('hooks')
      hooks.expects(:handle).with(:nodes_done).raises(StandardError.new('Hook error'))
      Oxidized.stubs(:hooks).returns(hooks)

      Oxidized::Worker.logger.expects(:error).with('Hook error')

      worker.send(:run_done_hook)

      _(worker.instance_variable_get(:@jobs_done)).must_equal 0
    end
  end
end
