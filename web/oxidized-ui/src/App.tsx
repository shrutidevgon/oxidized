import { useState, useEffect } from 'react'
import './App.css'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Server, RefreshCw, CheckCircle, XCircle, Clock, Search, Settings, Activity, Database, GitCompare } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface NodeData {
  name: string
  full_name: string
  ip: string
  group: string | null
  model: string
  last: {
    start: string
    end: string
    status: string
    time: number
  } | null
  vars: Record<string, string>
  mtime: string | null
}

interface ConfigVersion {
  oid: string
  date: string
  author: string
  message: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8888'

const mockNodes: NodeData[] = [
  {
    name: 'router01.example.com',
    full_name: 'core/router01.example.com',
    ip: '192.168.1.1',
    group: 'core',
    model: 'Oxidized::Model::IOS',
    last: { start: '2024-01-15T10:00:00Z', end: '2024-01-15T10:00:30Z', status: 'success', time: 30 },
    vars: {},
    mtime: '2024-01-15T10:00:30Z'
  },
  {
    name: 'switch01.example.com',
    full_name: 'access/switch01.example.com',
    ip: '192.168.1.2',
    group: 'access',
    model: 'Oxidized::Model::ProCurve',
    last: { start: '2024-01-15T09:55:00Z', end: '2024-01-15T09:55:45Z', status: 'success', time: 45 },
    vars: {},
    mtime: '2024-01-15T09:55:45Z'
  },
  {
    name: 'firewall01.example.com',
    full_name: 'security/firewall01.example.com',
    ip: '192.168.1.3',
    group: 'security',
    model: 'Oxidized::Model::ASA',
    last: { start: '2024-01-15T09:50:00Z', end: '2024-01-15T09:50:20Z', status: 'fail', time: 20 },
    vars: {},
    mtime: '2024-01-15T09:50:20Z'
  },
  {
    name: 'router02.example.com',
    full_name: 'core/router02.example.com',
    ip: '192.168.1.4',
    group: 'core',
    model: 'Oxidized::Model::JunOS',
    last: { start: '2024-01-15T09:45:00Z', end: '2024-01-15T09:45:35Z', status: 'success', time: 35 },
    vars: {},
    mtime: '2024-01-15T09:45:35Z'
  },
  {
    name: 'switch02.example.com',
    full_name: 'access/switch02.example.com',
    ip: '192.168.1.5',
    group: 'access',
    model: 'Oxidized::Model::IOS',
    last: null,
    vars: {},
    mtime: null
  }
]

const mockVersions: ConfigVersion[] = [
  { oid: 'abc123', date: '2024-01-15T10:00:30Z', author: 'oxidized', message: 'Configuration backup' },
  { oid: 'def456', date: '2024-01-14T10:00:30Z', author: 'oxidized', message: 'Configuration backup' },
  { oid: 'ghi789', date: '2024-01-13T10:00:30Z', author: 'admin', message: 'Manual trigger' },
]

const mockConfig = `!
! Cisco IOS Configuration
!
hostname router01
!
interface GigabitEthernet0/0
 description WAN Interface
 ip address 10.0.0.1 255.255.255.0
 no shutdown
!
interface GigabitEthernet0/1
 description LAN Interface
 ip address 192.168.1.1 255.255.255.0
 no shutdown
!
router ospf 1
 network 10.0.0.0 0.0.0.255 area 0
 network 192.168.1.0 0.0.0.255 area 0
!
ip route 0.0.0.0 0.0.0.0 10.0.0.254
!
line vty 0 4
 login local
 transport input ssh
!
end`

const activityData = [
  { time: '00:00', backups: 12 },
  { time: '04:00', backups: 8 },
  { time: '08:00', backups: 25 },
  { time: '12:00', backups: 18 },
  { time: '16:00', backups: 22 },
  { time: '20:00', backups: 15 },
]

const COLORS = ['#22c55e', '#ef4444', '#f59e0b']

function App() {
  const [nodes, setNodes] = useState<NodeData[]>(mockNodes)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [configContent, setConfigContent] = useState<string>(mockConfig)
  const [versions, setVersions] = useState<ConfigVersion[]>(mockVersions)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedVersion1, setSelectedVersion1] = useState<string>('')
  const [selectedVersion2, setSelectedVersion2] = useState<string>('')
  const [diffContent, setDiffContent] = useState<string>('')

  const fetchNodes = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/nodes`)
      if (response.ok) {
        const data = await response.json()
        setNodes(data)
      }
    } catch (error) {
      console.log('Using mock data - API not available')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchConfig = async (nodeName: string, group: string | null) => {
    try {
      const url = group 
        ? `${API_BASE_URL}/node/fetch/${group}/${nodeName}`
        : `${API_BASE_URL}/node/fetch/${nodeName}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.text()
        setConfigContent(data)
      }
    } catch (error) {
      console.log('Using mock config - API not available')
      setConfigContent(mockConfig)
    }
  }

  const fetchVersions = async (nodeName: string, group: string | null) => {
    try {
      const url = group
        ? `${API_BASE_URL}/node/version/${group}/${nodeName}`
        : `${API_BASE_URL}/node/version/${nodeName}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setVersions(data)
      }
    } catch (error) {
      console.log('Using mock versions - API not available')
      setVersions(mockVersions)
    }
  }

  const triggerBackup = async (nodeName: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/node/next/${nodeName}`, {
        method: 'GET'
      })
      if (response.ok) {
        alert(`Backup triggered for ${nodeName}`)
        fetchNodes()
      }
    } catch (error) {
      alert(`Backup triggered for ${nodeName} (mock)`)
    }
  }

  const reloadNodes = async () => {
    try {
      await fetch(`${API_BASE_URL}/reload`)
      fetchNodes()
    } catch (error) {
      console.log('Reload triggered (mock)')
      fetchNodes()
    }
  }

  const fetchDiff = async (nodeName: string, group: string | null, oid1: string, oid2: string) => {
    try {
      const url = group
        ? `${API_BASE_URL}/node/diff/${group}/${nodeName}/${oid1}/${oid2}`
        : `${API_BASE_URL}/node/diff/${nodeName}/${oid1}/${oid2}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.text()
        setDiffContent(data)
      }
    } catch (error) {
      setDiffContent(`--- Version ${oid1}\n+++ Version ${oid2}\n@@ -1,5 +1,5 @@\n hostname router01\n-ip address 10.0.0.1 255.255.255.0\n+ip address 10.0.0.2 255.255.255.0\n no shutdown`)
    }
  }

  useEffect(() => {
    fetchNodes()
  }, [])

  useEffect(() => {
    if (selectedNode) {
      fetchConfig(selectedNode.name, selectedNode.group)
      fetchVersions(selectedNode.name, selectedNode.group)
    }
  }, [selectedNode])

  useEffect(() => {
    if (selectedVersion1 && selectedVersion2 && selectedNode) {
      fetchDiff(selectedNode.name, selectedNode.group, selectedVersion1, selectedVersion2)
    }
  }, [selectedVersion1, selectedVersion2, selectedNode])

  const groups = ['all', ...new Set(nodes.map(n => n.group).filter(Boolean) as string[])]
  
  const filteredNodes = nodes.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.ip.includes(searchTerm) ||
                         node.model.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesGroup = selectedGroup === 'all' || node.group === selectedGroup
    return matchesSearch && matchesGroup
  })

  const stats = {
    total: nodes.length,
    success: nodes.filter(n => n.last?.status === 'success').length,
    failed: nodes.filter(n => n.last?.status === 'fail').length,
    pending: nodes.filter(n => !n.last).length
  }

  const pieData = [
    { name: 'Success', value: stats.success },
    { name: 'Failed', value: stats.failed },
    { name: 'Pending', value: stats.pending }
  ]

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending</Badge>
    if (status === 'success') return <Badge variant="outline" className="bg-green-100 text-green-800">Success</Badge>
    return <Badge variant="outline" className="bg-red-100 text-red-800">Failed</Badge>
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleString()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Oxidized</h1>
              <p className="text-sm text-gray-500">Network Configuration Backup</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={reloadNodes} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Reload Nodes
            </Button>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-white border">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="nodes" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Nodes
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Nodes</CardDescription>
                  <CardTitle className="text-3xl">{stats.total}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-gray-500">
                    <Server className="h-4 w-4 mr-1" />
                    Managed devices
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Successful Backups</CardDescription>
                  <CardTitle className="text-3xl text-green-600">{stats.success}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-green-600">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Last 24 hours
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Failed Backups</CardDescription>
                  <CardTitle className="text-3xl text-red-600">{stats.failed}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-red-600">
                    <XCircle className="h-4 w-4 mr-1" />
                    Needs attention
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pending</CardDescription>
                  <CardTitle className="text-3xl text-yellow-600">{stats.pending}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-yellow-600">
                    <Clock className="h-4 w-4 mr-1" />
                    Awaiting backup
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Backup Activity</CardTitle>
                  <CardDescription>Backups over the last 24 hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={activityData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="backups" stroke="#3b82f6" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Backup Status Distribution</CardTitle>
                  <CardDescription>Current status of all nodes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest backup operations</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Node</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Backup</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nodes.slice(0, 5).map((node) => (
                      <TableRow key={node.name}>
                        <TableCell className="font-medium">{node.name}</TableCell>
                        <TableCell>{node.group || '-'}</TableCell>
                        <TableCell>{getStatusBadge(node.last?.status)}</TableCell>
                        <TableCell>{formatDate(node.last?.end || null)}</TableCell>
                        <TableCell>{node.last?.time ? `${node.last.time}s` : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nodes" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Node Management</CardTitle>
                    <CardDescription>Manage and monitor all network devices</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search nodes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter by group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group} value={group}>
                            {group === 'all' ? 'All Groups' : group}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Backup</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNodes.map((node) => (
                      <TableRow key={node.name}>
                        <TableCell className="font-medium">{node.name}</TableCell>
                        <TableCell>{node.ip}</TableCell>
                        <TableCell>{node.group || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {node.model.split('::').pop()}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(node.last?.status)}</TableCell>
                        <TableCell>{formatDate(node.last?.end || null)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => triggerBackup(node.name)}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Backup
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedNode(node)}
                                >
                                  <Settings className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh]">
                                <DialogHeader>
                                  <DialogTitle>{node.name}</DialogTitle>
                                  <DialogDescription>
                                    {node.ip} | {node.group || 'No group'} | {node.model.split('::').pop()}
                                  </DialogDescription>
                                </DialogHeader>
                                <Tabs defaultValue="config" className="mt-4">
                                  <TabsList>
                                    <TabsTrigger value="config">Current Config</TabsTrigger>
                                    <TabsTrigger value="versions">Version History</TabsTrigger>
                                    <TabsTrigger value="diff">Compare Versions</TabsTrigger>
                                  </TabsList>
                                  <TabsContent value="config">
                                    <ScrollArea className="h-96 rounded border p-4 bg-gray-900">
                                      <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                                        {configContent}
                                      </pre>
                                    </ScrollArea>
                                  </TabsContent>
                                  <TabsContent value="versions">
                                    <ScrollArea className="h-96">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Version</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Author</TableHead>
                                            <TableHead>Message</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {versions.map((version) => (
                                            <TableRow key={version.oid}>
                                              <TableCell className="font-mono">{version.oid.substring(0, 7)}</TableCell>
                                              <TableCell>{formatDate(version.date)}</TableCell>
                                              <TableCell>{version.author}</TableCell>
                                              <TableCell>{version.message}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </ScrollArea>
                                  </TabsContent>
                                  <TabsContent value="diff">
                                    <div className="space-y-4">
                                      <div className="flex items-center gap-4">
                                        <Select value={selectedVersion1} onValueChange={setSelectedVersion1}>
                                          <SelectTrigger className="w-48">
                                            <SelectValue placeholder="Select version 1" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {versions.map((v) => (
                                              <SelectItem key={v.oid} value={v.oid}>
                                                {v.oid.substring(0, 7)} - {new Date(v.date).toLocaleDateString()}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <GitCompare className="h-5 w-5 text-gray-400" />
                                        <Select value={selectedVersion2} onValueChange={setSelectedVersion2}>
                                          <SelectTrigger className="w-48">
                                            <SelectValue placeholder="Select version 2" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {versions.map((v) => (
                                              <SelectItem key={v.oid} value={v.oid}>
                                                {v.oid.substring(0, 7)} - {new Date(v.date).toLocaleDateString()}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <ScrollArea className="h-80 rounded border p-4 bg-gray-900">
                                        <pre className="text-sm font-mono whitespace-pre-wrap">
                                          {diffContent.split('\n').map((line, i) => (
                                            <div
                                              key={i}
                                              className={
                                                line.startsWith('+') ? 'text-green-400' :
                                                line.startsWith('-') ? 'text-red-400' :
                                                line.startsWith('@@') ? 'text-blue-400' :
                                                'text-gray-400'
                                              }
                                            >
                                              {line}
                                            </div>
                                          ))}
                                        </pre>
                                      </ScrollArea>
                                    </div>
                                  </TabsContent>
                                </Tabs>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuration Browser</CardTitle>
                <CardDescription>Browse and compare device configurations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-1">
                    <h3 className="font-semibold mb-3">Select Node</h3>
                    <ScrollArea className="h-96 border rounded p-2">
                      {nodes.map((node) => (
                        <div key={node.name}>
                          <Button
                            variant={selectedNode?.name === node.name ? "secondary" : "ghost"}
                            className="w-full justify-start text-left mb-1"
                            onClick={() => setSelectedNode(node)}
                          >
                            <div className="flex items-center gap-2">
                              {node.last?.status === 'success' ? (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              ) : node.last?.status === 'fail' ? (
                                <XCircle className="h-3 w-3 text-red-500" />
                              ) : (
                                <Clock className="h-3 w-3 text-yellow-500" />
                              )}
                              <span className="truncate">{node.name}</span>
                            </div>
                          </Button>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                  <div className="md:col-span-3">
                    {selectedNode ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{selectedNode.name}</h3>
                            <p className="text-sm text-gray-500">
                              {selectedNode.ip} | {selectedNode.model.split('::').pop()}
                            </p>
                          </div>
                          <Button onClick={() => triggerBackup(selectedNode.name)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Trigger Backup
                          </Button>
                        </div>
                        <Separator />
                        <ScrollArea className="h-96 rounded border p-4 bg-gray-900">
                          <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                            {configContent}
                          </pre>
                        </ScrollArea>
                      </div>
                    ) : (
                      <div className="h-96 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Select a node to view its configuration</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t bg-white px-6 py-4 mt-8">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <p>Oxidized Web UI - Network Configuration Backup Tool</p>
          <p>API: {API_BASE_URL}</p>
        </div>
      </footer>
    </div>
  )
}

export default App
