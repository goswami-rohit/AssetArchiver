// src/pages/HomePage.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Edit,
  Plus,
  CheckCircle,
  Building2,
  FileText,
  BarChart3,
  LogIn,
  LogOut,
  Bell,
  Navigation,
  TrendingUp,
  DollarSign,
  Wrench,
  Trash2,
  Eye,
  MapIcon,
  PhoneCall,
  Star,
  ShoppingCart,
  Route,
  X,
  Loader2,
  MessageSquare,
  Clock,
  Target,
  Users,
  RefreshCw,
  Calendar,
  Briefcase,
  TrendingDown,
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

// Imported forms
import DVRForm from "@/pages/forms/DVRForm";
import TVRForm from "@/pages/forms/TVRForm";
import AttendanceInForm from "@/pages/forms/AttendanceInForm";
import AttendanceOutForm from "@/pages/forms/AttendanceOutForm";
import AddDealerForm from "@/pages/forms/AddDealerForm";
import SalesOrderForm from "@/pages/forms/SalesOrderForm";
import PJPForm from "@/pages/forms/AddPJPForm";

// Shared components
import { useAppStore, StatusBar, LoadingList, StatCard } from "@/components/ReusableUI";

/** Helper Components **/
function Empty({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Icon className="h-16 w-16 mx-auto opacity-30 mb-4" />
      <p className="text-base font-medium">{label}</p>
    </div>
  );
}

function Section({
  title,
  Icon,
  children,
  onAdd,
  isRefreshing = false,
  onRefresh,
}: {
  title: string;
  Icon: any;
  children: React.ReactNode;
  onAdd: () => void;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {isRefreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-3">
          {onRefresh && (
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <Button size="sm" className="rounded-full shadow-sm" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add New
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

function IconBtn({ onClick, Icon, tooltip, disabled = false, variant = "ghost" }: {
  onClick: () => void;
  Icon: any;
  tooltip?: string;
  disabled?: boolean;
  variant?: "ghost" | "destructive" | "outline";
}) {
  return (
    <Button
      variant={variant}
      size="icon"
      className="h-8 w-8 rounded-full hover:bg-muted"
      onClick={onClick}
      title={tooltip}
      disabled={disabled}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function TaskCard({
  task,
  onEdit,
  onDelete,
  onComplete,
  isUpdating = false,
}: {
  task: any;
  onEdit: (t: any) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  isUpdating?: boolean;
}) {
  const isCompleted = task.status === 'Completed';

  return (
    <Card className={`bg-card border shadow-sm hover:shadow-lg transition-all duration-300 ${
      isCompleted ? 'ring-2 ring-green-500/20 bg-green-950/20' : ''
    } ${isUpdating ? 'animate-pulse' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className={`font-medium text-lg mb-2 text-foreground ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
              {task.description || task.visitType || 'Daily Task'}
            </h3>
            {task.siteName && (
              <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                <MapIcon className="h-3 w-3" />
                {task.siteName}
              </p>
            )}
            {task.relatedDealerId && (
              <p className="text-sm text-blue-400 mb-2">Dealer: {task.relatedDealerName || task.relatedDealerId}</p>
            )}
            <div className="flex items-center flex-wrap gap-3">
              {task.visitType && (
                <Badge variant="outline" className="text-xs px-3 py-1">
                  {task.visitType}
                </Badge>
              )}
              <Badge
                variant={isCompleted ? "default" : "secondary"}
                className="text-xs px-3 py-1"
              >
                {task.status || "Assigned"}
              </Badge>
              {task.taskDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(task.taskDate).toLocaleDateString()}
                </span>
              )}
              {task.pjpId && <Badge variant="secondary" className="text-xs px-3 py-1">PJP</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconBtn
              onClick={() => onComplete(String(task.id))}
              Icon={isCompleted ? CheckCircle : Clock}
              tooltip={isCompleted ? "Completed" : "Mark Complete"}
              disabled={isUpdating || isCompleted}
              variant={isCompleted ? "default" : "outline"}
            />
            <IconBtn onClick={() => onEdit(task)} Icon={Edit} disabled={isUpdating} />
            <IconBtn onClick={() => onDelete(String(task.id))} Icon={Trash2} disabled={isUpdating} variant="destructive" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DealerCard({
  dealer,
  onView,
  onEdit,
  onDelete,
  onScore,
  isUpdating = false,
}: {
  dealer: any;
  onView: (d: any) => void;
  onEdit: (d: any) => void;
  onDelete: (id: string) => void;
  onScore: (d: any) => void;
  isUpdating?: boolean;
}) {
  return (
    <Card className={`bg-card border shadow-sm hover:shadow-lg transition-all duration-300 ${isUpdating ? 'animate-pulse' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 cursor-pointer" onClick={() => onView(dealer)}>
            <h3 className="font-medium text-lg mb-2 text-foreground">{dealer.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {dealer.region} {dealer.area ? `- ${dealer.area}` : ""}
            </p>
            <div className="flex items-center flex-wrap gap-3">
              {dealer.type && <Badge variant="outline" className="text-xs px-3 py-1">{dealer.type}</Badge>}
              {dealer.totalPotential && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ₹{Number(dealer.totalPotential).toLocaleString()}
                </span>
              )}
              {dealer.phoneNo && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <PhoneCall className="h-3 w-3" />
                  {dealer.phoneNo}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconBtn onClick={() => onScore(dealer)} Icon={Star} disabled={isUpdating} />
            <IconBtn onClick={() => onView(dealer)} Icon={Eye} disabled={isUpdating} />
            <IconBtn onClick={() => onEdit(dealer)} Icon={Edit} disabled={isUpdating} />
            <IconBtn onClick={() => onDelete(String(dealer.id))} Icon={Trash2} disabled={isUpdating} variant="destructive" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportCard({
  report,
  type,
  onView,
  onEdit,
  onDelete,
  isUpdating = false,
}: {
  report: any;
  type: "daily" | "sales" | "collection" | "tvr" | "dvr" | "client-report" | "competition-report";
  onView: (r: any) => void;
  onEdit?: (r: any) => void;
  onDelete?: (id: string) => void;
  isUpdating?: boolean;
}) {
  const getIcon = () => {
    switch (type) {
      case "sales": return TrendingUp;
      case "collection": return DollarSign;
      case "tvr": return Wrench;
      case "dvr": return Route;
      case "client-report": return Users;
      case "competition-report": return TrendingDown;
      default: return FileText;
    }
  };

  const getTitle = () => {
    switch (type) {
      case "sales": return `Sales Report - ${report.dealerId || report.customerName || "N/A"}`;
      case "collection": return `Collection - ₹${Number(report.collectedAmount || report.amount || 0).toLocaleString()}`;
      case "tvr": return `TVR - ${report.siteName || report.dealerName || "Technical Visit"}`;
      case "dvr": return `DVR - ${report.siteName || report.dealerName || "Daily Visit"}`;
      case "client-report": return `Client Report - ${report.clientName || "Client Visit"}`;
      case "competition-report": return `Competition Report - ${report.competitorName || "Market Analysis"}`;
      default: return report.title || "Report";
    }
  };

  const Icon = getIcon();

  return (
    <Card className={`bg-card border shadow-sm hover:shadow-lg transition-all duration-300 ${isUpdating ? 'animate-pulse' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 cursor-pointer" onClick={() => onView(report)}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-medium text-base text-foreground">{getTitle()}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {report.location || report.siteName || report.dealerName || "Field Visit"}
            </p>
            <div className="flex items-center flex-wrap gap-3">
              <Badge variant="outline" className="text-xs px-3 py-1">
                {type.toUpperCase().replace('-', ' ')}
              </Badge>
              {(report.reportDate || report.date || report.createdAt) && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(report.reportDate || report.date || report.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconBtn onClick={() => onView(report)} Icon={Eye} disabled={isUpdating} />
            {onEdit && <IconBtn onClick={() => onEdit(report)} Icon={Edit} disabled={isUpdating} />}
            {onDelete && <IconBtn onClick={() => onDelete(String(report.id))} Icon={Trash2} disabled={isUpdating} variant="destructive" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskForm({
  userId,
  initialData,
  onSubmitted,
  onCancel
}: {
  userId?: string;
  initialData?: any;
  onSubmitted: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const { dealers, pjps } = useAppStore();
  
  const [formData, setFormData] = useState({
    taskDate: initialData?.taskDate || new Date().toISOString().split('T')[0],
    visitType: initialData?.visitType || 'Routine Visit',
    relatedDealerId: initialData?.relatedDealerId || '',
    siteName: initialData?.siteName || '',
    description: initialData?.description || '',
    status: initialData?.status || 'Assigned',
    pjpId: initialData?.pjpId || '',
    assignedByUserId: Number(userId),
  });
  
  const [isPjpEnabled, setIsPjpEnabled] = useState(!!initialData?.pjpId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Visit types for cement industry in India
  const visitTypes = [
    'Collection',
    'Reporting', 
    'Routine Visit',
    'Restocking',
    'Quality Check',
    'Market Survey',
    'Customer Meeting',
    'Payment Follow-up'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Using your exact createAutoCRUD endpoint format
    const endpoint = initialData ? `/api/daily-tasks/${initialData.id}` : '/api/daily-tasks';
    const method = initialData ? 'PUT' : 'POST';

    try {
      console.log(`📝 Submitting task to ${endpoint}`, formData);
      
      const payload = {
        ...formData,
        userId: Number(userId),
        assignedByUserId: Number(userId),
        pjpId: isPjpEnabled ? formData.pjpId || null : null,
        relatedDealerId: formData.relatedDealerId || null,
        ...(initialData && { updatedAt: new Date().toISOString() })
      };

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log('📝 Task submission result:', result);

      if (response.ok && result.success) {
        toast({
          title: "Success",
          description: result.message || `Task ${initialData ? 'updated' : 'created'} successfully`,
        });
        onSubmitted();
      } else {
        throw new Error(result.error || 'Failed to save task');
      }
    } catch (error) {
      console.error('Task submission failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save task',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="text-sm font-medium text-foreground">Task Date</label>
        <input
          type="date"
          value={formData.taskDate}
          onChange={(e) => setFormData(prev => ({ ...prev, taskDate: e.target.value }))}
          className="w-full mt-2 px-3 py-2 border border-border rounded-md bg-background text-foreground"
          required
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground">Visit Type</label>
        <select
          value={formData.visitType}
          onChange={(e) => setFormData(prev => ({ ...prev, visitType: e.target.value }))}
          className="w-full mt-2 px-3 py-2 border border-border rounded-md bg-background text-foreground"
          required
          disabled={isSubmitting}
        >
          {visitTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground">Select Dealer</label>
        <select
          value={formData.relatedDealerId}
          onChange={(e) => setFormData(prev => ({ ...prev, relatedDealerId: e.target.value }))}
          className="w-full mt-2 px-3 py-2 border border-border rounded-md bg-background text-foreground"
          disabled={isSubmitting}
        >
          <option value="">-- Select Dealer (Optional) --</option>
          {(dealers || []).map((dealer: any) => (
            <option key={dealer.id} value={dealer.id}>
              {dealer.name} - {dealer.region}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground">Site Name</label>
        <input
          type="text"
          value={formData.siteName}
          onChange={(e) => setFormData(prev => ({ ...prev, siteName: e.target.value }))}
          className="w-full mt-2 px-3 py-2 border border-border rounded-md bg-background text-foreground"
          placeholder="Enter site/location name"
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="w-full mt-2 px-3 py-2 border border-border rounded-md bg-background text-foreground"
          rows={3}
          placeholder="Task details and notes"
          disabled={isSubmitting}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="pjp-toggle"
          checked={isPjpEnabled}
          onChange={(e) => {
            setIsPjpEnabled(e.target.checked);
            if (!e.target.checked) {
              setFormData(prev => ({ ...prev, pjpId: '' }));
            }
          }}
          className="rounded border-border"
          disabled={isSubmitting}
        />
        <label htmlFor="pjp-toggle" className="text-sm font-medium text-foreground">
          Link to Journey Plan (PJP)
        </label>
      </div>

      {isPjpEnabled && (
        <div>
          <label className="text-sm font-medium text-foreground">Select Journey Plan</label>
          <select
            value={formData.pjpId}
            onChange={(e) => setFormData(prev => ({ ...prev, pjpId: e.target.value }))}
            className="w-full mt-2 px-3 py-2 border border-border rounded-md bg-background text-foreground"
            disabled={isSubmitting}
          >
            <option value="">-- Select Journey Plan --</option>
            {(pjps || []).map((pjp: any) => (
              <option key={pjp.id} value={pjp.id}>
                {pjp.objective} - {new Date(pjp.planDate).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-foreground">Status</label>
        <select
          value={formData.status}
          onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
          className="w-full mt-2 px-3 py-2 border border-border rounded-md bg-background text-foreground"
          disabled={isSubmitting}
        >
          <option value="Assigned">Assigned</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="On Hold">On Hold</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            `${initialData ? 'Update' : 'Create'} Task`
          )}
        </Button>
      </div>
    </form>
  );
}

/** API ACTIONS USING YOUR EXACT createAutoCRUD ENDPOINTS **/
const useAPIActions = () => {
  const { setData, setLoading } = useAppStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    try {
      console.log(`🔗 API Call: ${endpoint}`, options.method || 'GET');
      
      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ API Response from ${endpoint}:`, data);
      return data;
    } catch (error) {
      console.error(`❌ API call failed for ${endpoint}:`, error);
      throw error;
    }
  }, []);

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const response = await apiCall(`/api/user/${userId}`);
      if (response?.user) {
        return response.user;
      }
      throw new Error('User profile not found');
    } catch (error) {
      console.error('Fetch user profile failed:', error);
      throw error;
    }
  }, [apiCall]);

  const fetchAllData = useCallback(async (userId: string) => {
    if (!userId) return;

    setIsRefreshing(true);
    try {
      console.log(`🔄 Fetching all data for user ${userId}`);
      
      const [
        userProfileRes,
        tasksRes,
        pjpsRes,
        dealersRes,
        dvrRes,
        tvrRes,
        attendanceRes,
        salesRes,
        collectionRes,
        leaveRes,
        clientReportRes,
        competitionRes,
        brandsRes,
        ratingsRes,
        ddpRes,
        dealerBrandMappingRes
      ] = await Promise.allSettled([
        apiCall(`/api/user/${userId}`),
        apiCall(`/api/daily-tasks/user/${userId}`),
        apiCall(`/api/pjp/${userId}`),
        apiCall(`/api/dealers/user/${userId}`),
        apiCall(`/api/dvr/user/${userId}?limit=20`),
        apiCall(`/api/tvr/user/${userId}`),
        apiCall(`/api/attendance/user/${userId}`),
        apiCall(`/api/sales-reports/user/${userId}`),
        apiCall(`/api/collection-reports/user/${userId}`),
        apiCall(`/api/leave-applications/user/${userId}`),
        apiCall(`/api/client-reports/user/${userId}`),
        apiCall(`/api/competition-reports/user/${userId}`),
        apiCall(`/api/brands/user/${userId}`),
        apiCall(`/api/ratings/user/${userId}`),
        apiCall(`/api/ddp/user/${userId}`),
        apiCall(`/api/dealer-brand-mapping/user/${userId}`)
      ]);

      // Extract data from responses
      const userProfile = userProfileRes.status === 'fulfilled' ? userProfileRes.value.user || null : null;
      const dailyTasksData = tasksRes.status === 'fulfilled' ? tasksRes.value.data || [] : [];
      const pjpsData = pjpsRes.status === 'fulfilled' ? pjpsRes.value.data || [] : [];
      const dealersData = dealersRes.status === 'fulfilled' ? dealersRes.value.data || [] : [];
      const reportsData = dvrRes.status === 'fulfilled' ? dvrRes.value.data || [] : [];
      const tvrReportsData = tvrRes.status === 'fulfilled' ? tvrRes.value.data || [] : [];
      const salesReportsData = salesRes.status === 'fulfilled' ? salesRes.value.data || [] : [];
      const collectionReportsData = collectionRes.status === 'fulfilled' ? collectionRes.value.data || [] : [];
      const clientReportsData = clientReportRes.status === 'fulfilled' ? clientReportRes.value.data || [] : [];
      const competitionReportsData = competitionRes.status === 'fulfilled' ? competitionRes.value.data || [] : [];

      // Log any failed requests for debugging
      if (tasksRes.status === 'rejected') {
        console.error('❌ Daily tasks fetch failed:', tasksRes.reason);
      }
      if (pjpsRes.status === 'rejected') {
        console.error('❌ PJP fetch failed:', pjpsRes.reason);
      }
      if (dealersRes.status === 'rejected') {
        console.error('❌ Dealers fetch failed:', dealersRes.reason);
      }

      // Update user profile
      if (userProfile) {
        useAppStore.getState().setUser(userProfile);
      }

      // CALCULATE DASHBOARD STATS FROM API DATA
      const today = new Date().toDateString();
      const todaysTasks = dailyTasksData.filter((task: any) => {
        const taskDate = task.taskDate ? new Date(task.taskDate).toDateString() : today;
        return taskDate === today;
      });

      const activePJPs = pjpsData.filter((pjp: any) => pjp.status === 'planned' || !pjp.status);

      const totalReports = reportsData.length + 
                          tvrReportsData.length + 
                          salesReportsData.length + 
                          collectionReportsData.length +
                          clientReportsData.length +
                          competitionReportsData.length;

      const dashboardStats = {
        todaysTasks: todaysTasks.length,
        activePJPs: activePJPs.length,
        totalDealers: dealersData.length,
        totalReports: totalReports
      };

      console.log('📊 Calculated Dashboard Stats:', dashboardStats);
      console.log('📋 Daily Tasks:', dailyTasksData.length, dailyTasksData);
      console.log('🗺️ PJPs:', pjpsData.length, pjpsData);
      console.log('🏢 Dealers:', dealersData.length, dealersData);

      // SET ALL DATA IN ZUSTAND STORE
      setData('dailyTasks', dailyTasksData);
      setData('pjps', pjpsData);
      setData('dealers', dealersData);
      setData('reports', reportsData);
      setData('tvrReports', tvrReportsData);
      setData('attendanceHistory', attendanceRes.status === 'fulfilled' ? attendanceRes.value.data || [] : []);
      setData('salesReports', salesReportsData);
      setData('collectionReports', collectionReportsData);
      setData('leaveApplications', leaveRes.status === 'fulfilled' ? leaveRes.value.data || [] : []);
      setData('clientReports', clientReportsData);
      setData('competitionReports', competitionReportsData);
      setData('brands', brandsRes.status === 'fulfilled' ? brandsRes.value.data || [] : []);
      setData('ratings', ratingsRes.status === 'fulfilled' ? ratingsRes.value.data || [] : []);
      setData('ddpReports', ddpRes.status === 'fulfilled' ? ddpRes.value.data || [] : []);
      setData('dealerBrandMappings', dealerBrandMappingRes.status === 'fulfilled' ? dealerBrandMappingRes.value.data || [] : []);
      setData('dealerScores', []);
      setData('dashboardStats', dashboardStats);

      console.log('✅ All data loaded successfully');
      toast({
        title: "Data Updated",
        description: "Successfully loaded latest data",
      });

    } catch (error) {
      console.error('❌ Failed to fetch data:', error);
      toast({
        title: "Connection Error",
        description: "Failed to load data. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [apiCall, setData, toast]);

  const completeTask = useCallback(async (taskId: string) => {
    try {
      console.log(`⏱️ Completing task ${taskId}`);
      const response = await apiCall(`/api/daily-tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Completed', completedAt: new Date().toISOString() })
      });

      if (response?.success) {
        const { user } = useAppStore.getState();
        if (user) {
          await fetchAllData(String(user.id));
        }
        toast({
          title: "Task Completed",
          description: "Task marked as completed successfully",
        });
        return response;
      }
    } catch (error) {
      console.error('Complete task failed:', error);
      toast({
        title: "Error",
        description: "Failed to complete task. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  }, [apiCall, fetchAllData, toast]);

  const scoringDealer = useCallback(async (dealerId: string, scoreData: any) => {
    try {
      console.log(`⭐ Scoring dealer ${dealerId}`);
      const resp = await apiCall('/api/dealer-reports-scores', {
        method: 'POST',
        body: JSON.stringify({ 
          dealerId, 
          dealerScore: 5.0,
          trustWorthinessScore: 4.5,
          creditWorthinessScore: 4.0,
          orderHistoryScore: 4.5,
          visitFrequencyScore: 3.5,
          ...scoreData 
        })
      });
      if (resp?.success) {
        const { user } = useAppStore.getState();
        if (user) await fetchAllData(String(user.id));
        toast({
          title: "Dealer Scored",
          description: "Dealer score updated successfully",
        });
      }
      return resp;
    } catch (error) {
      console.error('Dealer scoring failed:', error);
      toast({
        title: "Scoring Failed",
        description: "Failed to update dealer score. Please try again.",
        variant: "destructive",
      });
    }
  }, [apiCall, fetchAllData, toast]);

  const deleteRecord = useCallback(
    async (type: string, id: string) => {
      // MAPPING TO YOUR EXACT createAutoCRUD ENDPOINT NAMES
      const endpoints: Record<string, (id: string) => string> = {
        task: (id) => `/api/daily-tasks/${id}`, // EXACT endpoint
        pjp: (id) => `/api/pjp/${id}`, // EXACT endpoint
        dealer: (id) => `/api/dealers/${id}`, // EXACT endpoint
        dvr: (id) => `/api/dvr/${id}`,
        tvr: (id) => `/api/tvr/${id}`,
        'sales-report': (id) => `/api/sales-reports/${id}`,
        'collection-report': (id) => `/api/collection-reports/${id}`,
        'leave-application': (id) => `/api/leave-applications/${id}`,
        'client-report': (id) => `/api/client-reports/${id}`,
        'competition-report': (id) => `/api/competition-reports/${id}`,
        'brand': (id) => `/api/brands/${id}`,
        'rating': (id) => `/api/ratings/${id}`,
        'ddp': (id) => `/api/ddp/${id}`,
        'dealer-brand-mapping': (id) => `/api/dealer-brand-mapping/${id}`,
      };

      try {
        console.log(`🗑️ Deleting ${type} with ID ${id}`);
        const resp = await apiCall(endpoints[type](id), { method: "DELETE" });
        if (resp?.success) {
          const { user } = useAppStore.getState();
          if (user) await fetchAllData(String(user.id));
          toast({
            title: "Deleted Successfully",
            description: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`,
          });
        }
        return resp;
      } catch (e) {
        console.error("Delete failed", e);
        toast({
          title: "Delete Failed",
          description: "Failed to delete item. Please try again.",
          variant: "destructive",
        });
      }
    },
    [apiCall, fetchAllData, toast]
  );

  return {
    fetchAllData,
    fetchUserProfile,
    completeTask,
    scoringDealer,
    deleteRecord,
    isRefreshing
  };
};

export default function HomePage() {
  const [, setLocation] = useLocation();
  const navigate = (path: string) => setLocation(path);

  const {
    user,
    setUser,
    attendanceStatus,
    setAttendanceStatus,
    isLoading,
    dailyTasks,
    pjps,
    dealers,
    reports,
    tvrReports,
    salesReports,
    collectionReports,
    leaveApplications,
    clientReports,
    competitionReports,
    dashboardStats,
    showCreateModal,
    showDetailModal,
    selectedItem,
    setUIState,
    resetModals,
  } = useAppStore();

  const {
    fetchAllData,
    fetchUserProfile,
    completeTask,
    scoringDealer,
    deleteRecord,
    isRefreshing
  } = useAPIActions();

  // Dialog states for quick actions
  const [openDvr, setOpenDvr] = useState(false);
  const [openTvr, setOpenTvr] = useState(false);
  const [openDealer, setOpenDealer] = useState(false);
  const [openPjp, setOpenPjp] = useState(false);
  const [openIn, setOpenIn] = useState(false);
  const [openOut, setOpenOut] = useState(false);
  const [openSales, setOpenSales] = useState(false);

  // USER INITIALIZATION USING YOUR EXACT PATTERN
  useEffect(() => {
    const initializeApp = async () => {
      const storedUser = localStorage.getItem("user");
      const storedUserId = localStorage.getItem("userId");

      if (storedUser && storedUserId) {
        try {
          const parsedUser = JSON.parse(storedUser);
          
          // Fetch fresh user profile from your API
          const freshUser = await fetchUserProfile(storedUserId);
          setUser(freshUser);

          // Fetch all data using the user ID
          await fetchAllData(storedUserId);

          console.log("✅ App initialized with user:", freshUser.firstName);
        } catch (error) {
          console.error("❌ Failed to initialize user");
          localStorage.clear();
          navigate("/login");
        }
      } else {
        console.log("❌ No stored user found");
        navigate("/login");
      }
    };

    if (!user) {
      initializeApp();
    }
  }, [user, setUser, navigate, fetchAllData, fetchUserProfile]);

  // Modal handlers
  const openCreateModal = (type: any) => {
    setUIState('createType', type);
    setUIState('showCreateModal', true);
  };

  const openDetailModal = (item: any) => {
    setUIState('selectedItem', item);
    setUIState('showDetailModal', true);
  };

  // Refresh all data
  const refreshAllData = useCallback(async () => {
    if (user) {
      await fetchAllData(String(user.id));
    }
  }, [user, fetchAllData]);

  // Logout handler
  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    navigate('/login');
  };

  // Calculate today's data
  const todaysTasks = useMemo(() => {
    const today = new Date().toDateString();
    return (dailyTasks || []).filter((task: any) => {
      const taskDate = task.taskDate ? new Date(task.taskDate).toDateString() : today;
      return taskDate === today;
    });
  }, [dailyTasks]);

  // Include all report types
  const allReports = useMemo(() => [
    ...(reports || []).map((r: any) => ({ ...r, type: 'dvr' })),
    ...(tvrReports || []).map((r: any) => ({ ...r, type: 'tvr' })),
    ...(salesReports || []).map((r: any) => ({ ...r, type: 'sales' })),
    ...(collectionReports || []).map((r: any) => ({ ...r, type: 'collection' })),
    ...(clientReports || []).map((r: any) => ({ ...r, type: 'client-report' })),
    ...(competitionReports || []).map((r: any) => ({ ...r, type: 'competition-report' })),
  ].sort((a, b) => new Date(b.createdAt || b.reportDate || 0).getTime() - new Date(a.createdAt || a.reportDate || 0).getTime()),
    [reports, tvrReports, salesReports, collectionReports, clientReports, competitionReports]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-background text-foreground">
      <StatusBar />

      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Welcome, {user?.firstName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {user?.company?.companyName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-6 py-4 bg-background/95">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            Icon={Target}
            label="Today's Tasks"
            value={dashboardStats?.todaysTasks || 0}
            gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          />
          <StatCard
            Icon={Route}
            label="Active PJPs"
            value={dashboardStats?.activePJPs || 0}
            gradient="bg-gradient-to-br from-purple-500 to-indigo-700"
          />
          <StatCard
            Icon={Building2}
            label="Dealers"
            value={dashboardStats?.totalDealers || 0}
            gradient="bg-gradient-to-br from-orange-500 to-red-700"
          />
          <StatCard
            Icon={BarChart3}
            label="Reports"
            value={dashboardStats?.totalReports || 0}
            gradient="bg-gradient-to-br from-green-500 to-emerald-700"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-6 pb-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            onClick={() => setOpenIn(true)}
            variant={attendanceStatus === 'out' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap"
            disabled={attendanceStatus === 'in'}
          >
            <LogIn className="h-4 w-4" />
            Punch In
          </Button>

          <Button
            onClick={() => setOpenOut(true)}
            variant={attendanceStatus === 'in' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap"
            disabled={attendanceStatus === 'out'}
          >
            <LogOut className="h-4 w-4" />
            Punch Out
          </Button>

          <Button onClick={() => setOpenDvr(true)} variant="outline" size="sm" className="flex items-center gap-2 whitespace-nowrap">
            <Route className="h-4 w-4" />
            DVR
          </Button>

          <Button onClick={() => setOpenTvr(true)} variant="outline" size="sm" className="flex items-center gap-2 whitespace-nowrap">
            <Wrench className="h-4 w-4" />
            TVR
          </Button>

          <Button onClick={() => setOpenDealer(true)} variant="outline" size="sm" className="flex items-center gap-2 whitespace-nowrap">
            <Building2 className="h-4 w-4" />
            Add Dealer
          </Button>

          <Button onClick={() => setOpenPjp(true)} variant="outline" size="sm" className="flex items-center gap-2 whitespace-nowrap">
            <Navigation className="h-4 w-4" />
            Plan Journey
          </Button>

          <Button onClick={() => setOpenSales(true)} variant="outline" size="sm" className="flex items-center gap-2 whitespace-nowrap">
            <ShoppingCart className="h-4 w-4" />
            Sales Order
          </Button>

          <Button onClick={refreshAllData} variant="outline" size="sm" className="flex items-center gap-2 whitespace-nowrap" disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 pb-6">
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="pjps">PJP</TabsTrigger>
            <TabsTrigger value="dealers">Dealers</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="chat">Chat AI</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-6">
            {/* ENHANCED DAILY TASKS SECTION - REMOVED ACTIVE JOURNEY PLANS */}
            <Section
              title="Today's Tasks"
              Icon={Target}
              onAdd={() => openCreateModal('task')}
              isRefreshing={isRefreshing}
              onRefresh={refreshAllData}
            >
              {isLoading ? (
                <LoadingList />
              ) : todaysTasks.length > 0 ? (
                <div className="space-y-3">
                  {todaysTasks.map((task: any) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={openDetailModal}
                      onDelete={(id) => deleteRecord('task', id)}
                      onComplete={completeTask}
                    />
                  ))}
                </div>
              ) : (
                <Empty icon={Target} label="No tasks scheduled for today" />
              )}
            </Section>
          </TabsContent>

          <TabsContent value="pjps" className="space-y-6">
            <Section
              title="All Journey Plans"
              Icon={Route}
              onAdd={() => openCreateModal('pjp')}
              isRefreshing={isRefreshing}
              onRefresh={refreshAllData}
            >
              {isLoading ? (
                <LoadingList />
              ) : (pjps || []).length > 0 ? (
                <div className="space-y-3">
                  {(pjps || []).map((pjp: any) => (
                    <Card key={pjp.id} className="bg-card border shadow-sm hover:shadow-lg transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 cursor-pointer" onClick={() => openDetailModal(pjp)}>
                            <h3 className="font-medium text-lg mb-2 text-foreground">
                              {pjp.objective}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">{pjp.siteName || pjp.location}</p>
                            <div className="flex items-center flex-wrap gap-3">
                              <Badge variant="outline" className="text-xs px-3 py-1">
                                {pjp.status || 'planned'}
                              </Badge>
                              {pjp.planDate && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(pjp.planDate).toLocaleDateString()}
                                </span>
                              )}
                              {pjp.areaToBeVisited && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapIcon className="h-3 w-3" />
                                  {pjp.areaToBeVisited}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <IconBtn onClick={() => openDetailModal(pjp)} Icon={Eye} />
                            <IconBtn onClick={() => openDetailModal(pjp)} Icon={Edit} />
                            <IconBtn onClick={() => deleteRecord('pjp', String(pjp.id))} Icon={Trash2} variant="destructive" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Empty icon={Route} label="No journey plans found" />
              )}
            </Section>
          </TabsContent>

          <TabsContent value="dealers" className="space-y-6">
            <Section
              title="Dealers"
              Icon={Building2}
              onAdd={() => openCreateModal('dealer')}
              isRefreshing={isRefreshing}
              onRefresh={refreshAllData}
            >
              {isLoading ? (
                <LoadingList />
              ) : (dealers || []).length > 0 ? (
                <div className="space-y-3">
                  {(dealers || []).map((dealer: any) => (
                    <DealerCard
                      key={dealer.id}
                      dealer={dealer}
                      onView={openDetailModal}
                      onEdit={openDetailModal}
                      onDelete={(id) => deleteRecord('dealer', id)}
                      onScore={(dealer) => scoringDealer(dealer.id, { score: 5 })}
                    />
                  ))}
                </div>
              ) : (
                <Empty icon={Building2} label="No dealers found" />
              )}
            </Section>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Section
              title="Recent Reports"
              Icon={FileText}
              onAdd={() => openCreateModal('dvr')}
              isRefreshing={isRefreshing}
              onRefresh={refreshAllData}
            >
              {isLoading ? (
                <LoadingList />
              ) : allReports.length > 0 ? (
                <div className="space-y-3">
                  {allReports.slice(0, 10).map((report: any) => (
                    <ReportCard
                      key={`${report.type}-${report.id}`}
                      report={report}
                      type={report.type}
                      onView={openDetailModal}
                      onEdit={openDetailModal}
                      onDelete={(id) => deleteRecord(report.type, id)}
                    />
                  ))}
                </div>
              ) : (
                <Empty icon={FileText} label="No reports found" />
              )}
            </Section>
          </TabsContent>

          <TabsContent value="chat" className="space-y-6">
            <div className="h-[600px] border border-border rounded-lg bg-card">
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>Chat AI feature coming soon</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs for Quick Actions */}
      <Dialog open={openDvr} onOpenChange={setOpenDvr}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Daily Visit Report</DialogTitle>
          </DialogHeader>
          <DVRForm
            userId={String(user?.id)}
            onSubmitted={() => {
              setOpenDvr(false);
              refreshAllData();
            }}
            onCancel={() => setOpenDvr(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openTvr} onOpenChange={setOpenTvr}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Technical Visit Report</DialogTitle>
          </DialogHeader>
          <TVRForm
            userId={String(user?.id)}
            onSubmitted={() => {
              setOpenTvr(false);
              refreshAllData();
            }}
            onCancel={() => setOpenTvr(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openDealer} onOpenChange={setOpenDealer}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Dealer</DialogTitle>
          </DialogHeader>
          <AddDealerForm
            userId={String(user?.id)}
            onSubmitted={() => {
              setOpenDealer(false);
              refreshAllData();
            }}
            onCancel={() => setOpenDealer(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openPjp} onOpenChange={setOpenPjp}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Plan New Journey</DialogTitle>
          </DialogHeader>
          <PJPForm
            userId={String(user?.id)}
            onSubmitted={() => {
              setOpenPjp(false);
              refreshAllData();
            }}
            onCancel={() => setOpenPjp(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openIn} onOpenChange={setOpenIn}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Punch In</DialogTitle>
          </DialogHeader>
          <AttendanceInForm
            userId={String(user?.id)}
            onSubmitted={() => {
              setOpenIn(false);
              setAttendanceStatus("in");
              refreshAllData();
            }}
            onCancel={() => setOpenIn(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openOut} onOpenChange={setOpenOut}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Punch Out</DialogTitle>
          </DialogHeader>
          <AttendanceOutForm
            userId={String(user?.id)}
            onSubmitted={() => {
              setOpenOut(false);
              setAttendanceStatus("out");
              refreshAllData();
            }}
            onCancel={() => setOpenOut(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openSales} onOpenChange={setOpenSales}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Sales Order</DialogTitle>
          </DialogHeader>
          <SalesOrderForm
            userId={String(user?.id)}
            onSubmitted={() => {
              setOpenSales(false);
              refreshAllData();
            }}
            onCancel={() => setOpenSales(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal} onOpenChange={resetModals}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <TaskForm
            userId={String(user?.id)}
            onSubmitted={() => {
              resetModals();
              refreshAllData();
            }}
            onCancel={resetModals}
          />
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={resetModals}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-auto text-foreground">
              {JSON.stringify(selectedItem, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}