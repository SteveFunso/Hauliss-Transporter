import { useState, useEffect, useRef } from 'react';
import {
  Search,
  MoreVertical,
  MessageSquare,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  Send,
  User,
  Eye,
  Archive,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useApi } from '@/hooks/useApi';
import { usePagination } from '@/hooks/usePagination';
import { getDisputes, updateDispute, createDispute, type AdminDispute } from '@/lib/api/disputes';
import { toast } from 'sonner';

export function Support() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<AdminDispute | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [showNewTicketDialog, setShowNewTicketDialog] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', description: '', issueType: 'general', priority: 'medium', tripId: '' });
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [callCenterOpen, setCallCenterOpen] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const pagination = usePagination(20);

  const { data, isLoading, refetch } = useApi(
    () => getDisputes({ page: pagination.page, limit: pagination.limit, status: statusFilter }),
    [pagination.page, statusFilter]
  );

  useEffect(() => {
    if (data?.pagination) {
      pagination.setTotal(data.pagination.total);
    }
  }, [data]);

  const disputes = data?.data ?? [];

  const filteredTickets = disputes.filter(ticket => {
    const matchesSearch = !searchQuery ||
      ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.issue_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Compute stats from loaded data
  const openCount = disputes.filter(d => d.status === 'open' || d.status === 'pending').length;
  const inProgressCount = disputes.filter(d => d.status === 'investigating').length;
  const resolvedCount = disputes.filter(d => d.status === 'resolved').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
      case 'pending':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Open</Badge>;
      case 'in_progress':
      case 'investigating':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">In Progress</Badge>;
      case 'resolved':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Resolved</Badge>;
      case 'closed':
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return <AlertCircle className="w-4 h-4" />;
      case 'trip':
        return <MessageSquare className="w-4 h-4" />;
      case 'driver':
        return <User className="w-4 h-4" />;
      case 'technical':
        return <Mail className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await updateDispute(id, { status: 'resolved' });
      toast.success('Ticket resolved');
      refetch();
      if (selectedTicket?.id === id) {
        setSelectedTicket(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve ticket');
    }
  };

  const handleClose = async (id: string) => {
    try {
      await updateDispute(id, { status: 'closed' });
      toast.success('Ticket closed');
      refetch();
      if (selectedTicket?.id === id) {
        setSelectedTicket(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to close ticket');
    }
  };

  const handleSendReply = async () => {
    if (replyMessage.trim() && selectedTicket) {
      try {
        await updateDispute(selectedTicket.id, { response: replyMessage });
        toast.success('Reply sent');
        setReplyMessage('');
        refetch();
      } catch (err: any) {
        toast.error(err.message || 'Failed to send reply');
      }
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await updateDispute(id, { status: 'closed' });
      toast.success('Ticket archived');
      refetch();
      if (selectedTicket?.id === id) {
        setSelectedTicket(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive ticket');
    }
  };

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const handleNewTicketSubmit = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    // The disputes endpoint requires a real trip UUID. Validate up-front so we
    // don't fire a request that always 400s with a synthetic id.
    if (!UUID_RE.test(newTicket.tripId.trim())) {
      toast.error('A valid Trip ID (UUID) is required to submit a ticket');
      return;
    }
    setTicketSubmitting(true);
    try {
      await createDispute({
        trip_id: newTicket.tripId.trim(),
        issue_type: newTicket.issueType,
        description: `[${newTicket.priority.toUpperCase()}] ${newTicket.subject}\n\n${newTicket.description}`,
      });
      toast.success('Support ticket created');
      setShowNewTicketDialog(false);
      setNewTicket({ subject: '', description: '', issueType: 'general', priority: 'medium', tripId: '' });
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create ticket');
    } finally {
      setTicketSubmitting(false);
    }
  };

  const handleViewDetailsAndReply = (ticket: AdminDispute) => {
    setSelectedTicket(ticket);
    setTimeout(() => replyRef.current?.focus(), 100);
  };

  const formatTimestamp = (ts: number | string) => {
    // submitted_at is epoch-milliseconds, sometimes serialized as a string
    return new Date(Number(ts)).toLocaleDateString();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Support Tickets</h2>
          <p className="text-muted-foreground mt-1">
            Manage customer support requests and resolve issues
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setCallCenterOpen(true)}>
            <Phone className="w-4 h-4" />
            Call Center
          </Button>
          <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2" onClick={() => setShowNewTicketDialog(true)}>
            <Plus className="w-4 h-4" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Tickets</p>
                {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
                  <p className="text-2xl font-semibold">{openCount}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
                  <p className="text-2xl font-semibold">{inProgressCount}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
                  <p className="text-2xl font-semibold">{resolvedCount}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
                  <p className="text-2xl font-semibold">{data?.pagination?.total ?? disputes.length}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Page</p>
                {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
                  <p className="text-2xl font-semibold">{disputes.length}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets by ID or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  pagination.setPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="investigating">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets Table */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display font-semibold text-lg">
                All Tickets ({data?.pagination?.total ?? filteredTickets.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.map((ticket) => (
                        <TableRow
                          key={ticket.id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-mono font-medium text-xs">{ticket.id.slice(0, 12)}...</p>
                              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {ticket.description}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(ticket.issue_type)}
                              <span className="text-sm capitalize">{ticket.issue_type}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatTimestamp(ticket.submitted_at)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); }}>
                                  <Eye className="w-4 h-4 mr-2" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetailsAndReply(ticket); }}>
                                  <MessageSquare className="w-4 h-4 mr-2" /> Reply
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleResolve(ticket.id); }}>
                                  <CheckCircle className="w-4 h-4 mr-2" /> Resolve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(ticket.id); }}>
                                  <Archive className="w-4 h-4 mr-2" /> Archive
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                      <p className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={pagination.prevPage}
                          disabled={pagination.page <= 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={pagination.nextPage}
                          disabled={pagination.page >= pagination.totalPages}
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ticket Details Panel */}
        <div className="lg:col-span-1">
          {selectedTicket ? (
            <Card className="border-0 shadow-sm sticky top-24">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display font-semibold text-lg">
                    Ticket Details
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedTicket(null)}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Header */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                      selectedTicket.issue_type === 'payment' ? 'bg-red-100 text-red-600' :
                      selectedTicket.issue_type === 'trip' ? 'bg-blue-100 text-blue-600' :
                      selectedTicket.issue_type === 'driver' ? 'bg-purple-100 text-purple-600' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      {getTypeIcon(selectedTicket.issue_type)}
                    </div>
                    <div>
                      <h3 className="font-semibold capitalize">{selectedTicket.issue_type} Issue</h3>
                      <p className="text-sm text-muted-foreground font-mono">{selectedTicket.id.slice(0, 16)}...</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                    {selectedTicket.description}
                  </p>
                </div>

                {/* Trip Reference */}
                {selectedTicket.trip_id && (
                  <div>
                    <h4 className="font-medium mb-2">Trip Reference</h4>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg font-mono">
                      {selectedTicket.trip_id}
                    </p>
                  </div>
                )}

                {/* Evidence */}
                {selectedTicket.evidence_url && (
                  <div>
                    <h4 className="font-medium mb-2">Evidence</h4>
                    <a
                      href={selectedTicket.evidence_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#F97316] hover:underline"
                    >
                      View Evidence
                    </a>
                  </div>
                )}

                {/* Submitted Date */}
                <div>
                  <h4 className="font-medium mb-2">Submitted</h4>
                  <p className="text-sm text-muted-foreground">
                    {new Date(Number(selectedTicket.submitted_at)).toLocaleString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleResolve(selectedTicket.id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Resolve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleClose(selectedTicket.id)}
                  >
                    <Archive className="w-4 h-4 mr-1" />
                    Close
                  </Button>
                </div>

                {/* Reply */}
                <div className="space-y-2">
                  <Textarea
                    ref={replyRef}
                    placeholder="Type your reply..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <Button
                    className="w-full bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
                    onClick={handleSendReply}
                  >
                    <Send className="w-4 h-4" />
                    Send Reply
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a ticket to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Call Center Dialog */}
      <Dialog open={callCenterOpen} onOpenChange={setCallCenterOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">Call Center</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Contact our support team directly via phone.
            </p>
            <div className="p-4 rounded-lg bg-muted/50 text-center space-y-2">
              <p className="font-medium text-lg">Support Hotline</p>
              <a
                href="tel:+2348001234567"
                className="text-2xl font-bold text-[#F97316] hover:underline"
              >
                +234 800 123 4567
              </a>
              <p className="text-xs text-muted-foreground">Available Mon-Fri, 8am - 6pm WAT</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center space-y-2">
              <p className="font-medium text-lg">Emergency Line</p>
              <a
                href="tel:+2349001234567"
                className="text-2xl font-bold text-[#F97316] hover:underline"
              >
                +234 900 123 4567
              </a>
              <p className="text-xs text-muted-foreground">24/7 for urgent issues</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCallCenterOpen(false)}>Close</Button>
            <Button
              className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
              onClick={() => window.open('tel:+2348001234567')}
            >
              <Phone className="w-4 h-4" /> Call Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Ticket Dialog */}
      <Dialog open={showNewTicketDialog} onOpenChange={setShowNewTicketDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">Create New Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-trip-id">Trip ID</Label>
              <Input
                id="ticket-trip-id"
                placeholder="Trip UUID this ticket relates to"
                value={newTicket.tripId}
                onChange={(e) => setNewTicket({ ...newTicket, tripId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input
                id="ticket-subject"
                placeholder="Brief summary of the issue"
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-description">Description</Label>
              <Textarea
                id="ticket-description"
                placeholder="Describe the issue in detail..."
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                className="min-h-[100px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ticket-type">Issue Type</Label>
                <select
                  id="ticket-type"
                  value={newTicket.issueType}
                  onChange={(e) => setNewTicket({ ...newTicket, issueType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
                >
                  <option value="general">General</option>
                  <option value="payment">Payment</option>
                  <option value="trip">Trip</option>
                  <option value="driver">Driver</option>
                  <option value="technical">Technical</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-priority">Priority</Label>
                <select
                  id="ticket-priority"
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTicketDialog(false)} disabled={ticketSubmitting}>Cancel</Button>
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={handleNewTicketSubmit} disabled={ticketSubmitting}>
              {ticketSubmitting ? 'Creating...' : 'Create Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
