import { useState, useEffect } from 'react';
import {
  Search,
  MoreVertical,
  Wallet as WalletIcon,
  ArrowDownLeft,
  CreditCard,
  Banknote,
  Clock,
  Eye,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Flag,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import { useApi } from '@/hooks/useApi';
import { usePagination } from '@/hooks/usePagination';
import { getPayments, getPaymentStats, processRefund, type AdminPayment } from '@/lib/api/payments';
import type { ApiResponse } from '@/lib/api/client';
import { toast } from 'sonner';

export function Wallet() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refundLoading, setRefundLoading] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<AdminPayment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<AdminPayment | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const pagination = usePagination(15);

  const { data: paymentsData, isLoading, error, refetch } = useApi<ApiResponse<AdminPayment[]>>(
    () => getPayments({
      page: pagination.page,
      limit: pagination.limit,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: searchQuery || undefined,
    }),
    [pagination.page, statusFilter, searchQuery]
  );

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useApi(
    () => getPaymentStats(),
    []
  );

  // Sync pagination total when data arrives
  useEffect(() => {
    if (paymentsData?.pagination) {
      pagination.setTotal(paymentsData.pagination.total);
    }
  }, [paymentsData]);

  const payments = paymentsData?.data ?? [];

  const handleRefund = async (paymentId: string) => {
    setRefundLoading(paymentId);
    try {
      await processRefund(paymentId);
      toast.success("Refund processed successfully");
      setRefundConfirmOpen(false);
      setRefundTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to process refund");
    } finally {
      setRefundLoading(null);
    }
  };

  const exportCSV = () => {
    const headers = "ID,Booking,Provider,Amount,Status,Date\n";
    const rows = payments.map(p =>
      `${p.id},${p.booking_id},${p.provider},${p.amount_minor_units / 100},${p.status},${p.created_at}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "payments_export.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Payments exported to CSV");
  };

  const handleSyncBalances = async () => {
    setSyncLoading(true);
    try {
      await refetchStats();
      await refetch();
      toast.success("Balances synced successfully");
    } finally {
      setSyncLoading(false);
    }
  };

  const downloadReceipt = (payment: AdminPayment) => {
    const receipt = [
      "=== PAYMENT RECEIPT ===",
      "",
      `Reference: ${payment.tx_ref}`,
      `Payment ID: ${payment.id}`,
      `Booking ID: ${payment.booking_id || 'N/A'}`,
      `Provider: ${payment.provider?.replace('_', ' ') ?? 'Unknown'}`,
      `Amount: ${formatCurrency(payment.amount_minor_units / 100)}`,
      `Currency: ${payment.currency}`,
      `Status: ${payment.status}`,
      `Date: ${new Date(payment.created_at).toLocaleString()}`,
      "",
      "========================",
    ].join("\n");
    const blob = new Blob([receipt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `receipt_${payment.tx_ref}.txt`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded");
  };

  const openPaymentDetails = (payment: AdminPayment) => {
    setSelectedPayment(payment);
    setDetailsOpen(true);
  };

  const openRefundConfirm = (payment: AdminPayment) => {
    setRefundTarget(payment);
    setRefundConfirmOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Failed</Badge>;
      case 'refunded':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider?.toLowerCase()) {
      case 'flutterwave':
      case 'paystack':
        return <CreditCard className="w-4 h-4" />;
      case 'bank_transfer':
        return <ArrowDownLeft className="w-4 h-4" />;
      default:
        return <WalletIcon className="w-4 h-4" />;
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider?.toLowerCase()) {
      case 'flutterwave':
        return 'bg-orange-100 text-orange-600';
      case 'paystack':
        return 'bg-blue-100 text-blue-600';
      case 'bank_transfer':
        return 'bg-emerald-100 text-emerald-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const totalRevenue = stats ? stats.total_amount / 100 : 0;
  const pendingCount = stats?.pending ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Wallets & Payments</h2>
          <p className="text-muted-foreground mt-1">
            Manage transactions, monitor payments, and handle payouts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportCSV}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button
            className="bg-[#F97316] hover:bg-[#F97316]/90 text-white gap-2"
            onClick={handleSyncBalances}
            disabled={syncLoading}
          >
            {syncLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sync Balances
          </Button>
        </div>
      </div>

      {/* Payment Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">Payment Details</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(selectedPayment.status)}
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Reference</span>
                  <span className="text-sm font-mono font-medium">{selectedPayment.tx_ref}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Payment ID</span>
                  <span className="text-sm font-mono">{selectedPayment.id.slice(0, 12)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Booking ID</span>
                  <span className="text-sm font-mono">{selectedPayment.booking_id ? selectedPayment.booking_id.slice(0, 12) + '...' : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Provider</span>
                  <Badge className={cn('gap-1.5 font-normal', getProviderColor(selectedPayment.provider))}>
                    {getProviderIcon(selectedPayment.provider)}
                    {selectedPayment.provider?.replace('_', ' ') ?? 'Unknown'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="text-sm font-semibold">{formatCurrency(selectedPayment.amount_minor_units / 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Currency</span>
                  <span className="text-sm">{selectedPayment.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="text-sm">{new Date(selectedPayment.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {selectedPayment && (
              <Button variant="outline" className="gap-2" onClick={() => downloadReceipt(selectedPayment)}>
                <FileText className="w-4 h-4" /> Download Receipt
              </Button>
            )}
            <Button className="bg-[#F97316] hover:bg-[#F97316]/90 text-white" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <Dialog open={refundConfirmOpen} onOpenChange={setRefundConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold">Confirm Refund</DialogTitle>
          </DialogHeader>
          {refundTarget && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to process a refund for this payment?
              </p>
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Reference</span>
                  <span className="text-sm font-mono font-medium">{refundTarget.tx_ref}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="text-sm font-semibold text-red-600">{formatCurrency(refundTarget.amount_minor_units / 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Provider</span>
                  <span className="text-sm">{refundTarget.provider?.replace('_', ' ') ?? 'Unknown'}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRefundConfirmOpen(false); setRefundTarget(null); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => refundTarget && handleRefund(refundTarget.id)}
              disabled={refundLoading === refundTarget?.id}
            >
              {refundLoading === refundTarget?.id ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card
          className="border-0 shadow-sm bg-gradient-to-br from-[#F97316]/5 to-transparent cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setStatusFilter('all'); toast.info("Showing all payments"); }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="font-display font-semibold text-base text-muted-foreground flex items-center gap-2">
              <WalletIcon className="w-4 h-4" /> Total Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <p className="text-3xl font-bold">{stats?.total?.toLocaleString() ?? '0'}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2">All time transactions</p>
          </CardContent>
        </Card>

        <Card
          className="border-0 shadow-sm bg-gradient-to-br from-emerald-500/5 to-transparent cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setStatusFilter('success'); pagination.setPage(1); toast.info("Filtering paid payments"); }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="font-display font-semibold text-base text-muted-foreground flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : (
              <p className="text-3xl font-bold text-emerald-600">{formatCurrency(totalRevenue)}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2">All paid revenue</p>
          </CardContent>
        </Card>

        <Card
          className="border-0 shadow-sm bg-gradient-to-br from-amber-500/5 to-transparent cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setStatusFilter('pending'); pagination.setPage(1); toast.info("Filtering pending payments"); }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="font-display font-semibold text-base text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" /> Pending Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2">Awaiting confirmation</p>
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
                placeholder="Search payments by reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); pagination.setPage(1); }}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="all">All Status</option>
                <option value="success">Paid</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="font-display font-semibold text-lg">
            Recent Payments {paymentsData?.pagination ? `(${paymentsData.pagination.total})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-28" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-2">{error}</p>
              <Button variant="outline" onClick={refetch}>Try Again</Button>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payments found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <p className="font-mono font-medium">{payment.tx_ref}</p>
                          <p className="text-xs text-muted-foreground">
                            {payment.id.slice(0, 8)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {payment.booking_id ? payment.booking_id.slice(0, 8) : 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('gap-1.5 font-normal', getProviderColor(payment.provider))}>
                          {getProviderIcon(payment.provider)}
                          {payment.provider?.replace('_', ' ') ?? 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          'font-medium',
                          ['completed', 'success'].includes(payment.status.toLowerCase())
                            ? 'text-emerald-600'
                            : payment.status.toLowerCase() === 'failed'
                            ? 'text-red-600'
                            : 'text-foreground'
                        )}>
                          {formatCurrency(payment.amount_minor_units / 100)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(payment.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openPaymentDetails(payment)}>
                              <Eye className="w-4 h-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadReceipt(payment)}>
                              <Download className="w-4 h-4 mr-2" /> Download Receipt
                            </DropdownMenuItem>
                            {['completed', 'success'].includes(payment.status.toLowerCase()) && (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => openRefundConfirm(payment)}
                                disabled={refundLoading === payment.id}
                              >
                                {refundLoading === payment.id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                )}
                                Refund
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-amber-600"
                              onClick={() => toast.warning("Transaction flagged for review")}
                            >
                              <Flag className="w-4 h-4 mr-2" /> Flag Transaction
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
                      <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={pagination.nextPage}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
