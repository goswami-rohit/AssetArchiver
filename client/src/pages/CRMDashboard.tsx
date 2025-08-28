import React, { useEffect, useMemo, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { create } from "zustand";
import {
  Button,
} from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Home,
  MessageCircle,
  MapPin,
  User,
  Plus,
  CheckCircle,
  Calendar,
  Building2,
  FileText,
  BarChart3,
  LogIn,
  LogOut,
  Bell,
  Edit,
  Trash2,
  Eye,
  Navigation,
  Locate,
  RefreshCw,
  X,
  Award,
  Target,
  Star,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  ClipboardList,
  Settings,
  Shield,
  Clock,
  MapIcon,
  PhoneCall,
  Mail,
  Briefcase,
} from "lucide-react";

// External widgets
import ChatInterface from "@/components/ChatInterface";
import JourneyTracker from "@/components/JourneyTracker";

// --------------------
// Store
// --------------------
interface Company { companyName?: string }
interface UserShape {
  id: number
  firstName?: string
  lastName?: string
  email?: string
  role?: string
  company?: Company
  companyId?: number | null
}

interface AppState {
  user: UserShape | null
  currentPage: "home" | "ai" | "journey" | "profile"
  attendanceStatus: "in" | "out"
  isLoading: boolean
  isOnline: boolean
  lastSync: Date | null

  dailyTasks: any[]
  pjps: any[]
  dealers: any[]
  reports: any[]
  salesReports: any[]
  collectionReports: any[]
  dealerBrandMappings: any[]
  ddpReports: any[]
  leaveApplications: any[]
  brands: any[]
  userTargets: any[]
  dealerScores: any[]
  dashboardStats: any

  showCreateModal: boolean
  createType: "task" | "pjp" | "dealer" | "dvr" | "tvr" | "dealer-score" | "sales-report" | "collection-report" | "dealer-brand-mapping" | "ddp" | "leave-application"
  selectedItem: any
  showDetailModal: boolean

  setUser: (u: UserShape | null) => void
  setCurrentPage: (p: AppState["currentPage"]) => void
  setAttendanceStatus: (s: AppState["attendanceStatus"]) => void
  setLoading: (b: boolean) => void
  setOnlineStatus: (b: boolean) => void
  updateLastSync: () => void
  setData: (k: keyof Pick<AppState,
    | "dailyTasks" | "pjps" | "dealers" | "reports" | "salesReports" | "collectionReports" 
    | "dealerBrandMappings" | "ddpReports" | "leaveApplications" | "brands" | "userTargets" | "dealerScores" | "dashboardStats"
  >, data: any) => void
  setUIState: (k: keyof Pick<AppState,
    | "showCreateModal" | "createType" | "selectedItem" | "showDetailModal"
  >, v: any) => void
  resetModals: () => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  currentPage: "home",
  attendanceStatus: "out",
  isLoading: false,
  isOnline: true,
  lastSync: null,

  dailyTasks: [],
  pjps: [],
  dealers: [],
  reports: [],
  salesReports: [],
  collectionReports: [],
  dealerBrandMappings: [],
  ddpReports: [],
  leaveApplications: [],
  brands: [],
  userTargets: [],
  dealerScores: [],
  dashboardStats: {},

  showCreateModal: false,
  createType: "task",
  selectedItem: null,
  showDetailModal: false,

  setUser: (user) => set({ user }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setAttendanceStatus: (attendanceStatus) => set({ attendanceStatus }),
  setLoading: (isLoading) => set({ isLoading }),
  setOnlineStatus: (isOnline) => set({ isOnline }),
  updateLastSync: () => set({ lastSync: new Date() }),
  setData: (key, data) => set({ [key]: data } as any),
  setUIState: (key, value) => set({ [key]: value } as any),
  resetModals: () => set({ showCreateModal: false, showDetailModal: false, selectedItem: null }),
}))

// --------------------
// API Hook
// --------------------
const useAPI = () => {
  const { user, setLoading, setData, updateLastSync } = useAppStore.getState()

  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(endpoint, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        signal: controller.signal,
        ...options,
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data = await res.json()
      updateLastSync()
      return data
    } finally {
      clearTimeout(timeout)
    }
  }, [updateLastSync])

  const fetchDashboardStats = useCallback(async () => {
    if (!user) return
    try {
      const data = await apiCall(`/api/dashboard/stats/${user.id}`)
      setData("dashboardStats" as any, data?.data || {})
      setData("userTargets" as any, data?.data?.targets || [])
    } catch (e) {
      console.error("Dashboard stats error:", e)
    }
  }, [user, apiCall, setData])

  const fetchAllData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [
        tasks, pjps, dealers, dvr, 
        salesReports, collectionReports, dealerBrandMappings, 
        ddpReports, leaveApplications, brands
      ] = await Promise.all([
        apiCall(`/api/daily-tasks/user/${user.id}`),
        apiCall(`/api/pjp/user/${user.id}`),
        apiCall(`/api/dealers/user/${user.id}`),
        apiCall(`/api/dvr/user/${user.id}?limit=20`),
        apiCall(`/api/sales-reports/user/${user.id}`),
        apiCall(`/api/collection-reports/user/${user.id}`),
        apiCall(`/api/dealer-brand-mapping/user/${user.id}`),
        apiCall(`/api/ddp/user/${user.id}`),
        apiCall(`/api/leave-applications/user/${user.id}`),
        apiCall(`/api/brands`),
      ])

      setData("dailyTasks", tasks?.data ?? [])
      setData("pjps", pjps?.data ?? [])
      setData("dealers", dealers?.data ?? [])
      setData("reports", dvr?.data ?? [])
      setData("salesReports", salesReports?.data ?? [])
      setData("collectionReports", collectionReports?.data ?? [])
      setData("dealerBrandMappings", dealerBrandMappings?.data ?? [])
      setData("ddpReports", ddpReports?.data ?? [])
      setData("leaveApplications", leaveApplications?.data ?? [])
      setData("brands", brands?.data ?? [])

      await fetchDashboardStats()
    } catch (e) {
      console.error("Fetch all data error:", e)
    } finally {
      setLoading(false)
    }
  }, [user, apiCall, setData, setLoading, fetchDashboardStats])

  const handleAttendance = useCallback(async () => {
    if (!user) return
    const status = useAppStore.getState().attendanceStatus
    const endpoint = status === "out" ? "/api/attendance/punch-in" : "/api/attendance/punch-out"

    if (endpoint.endsWith("punch-in") && !user.companyId) {
      console.error("Missing companyId on user; cannot punch in.")
      return
    }

    try {
      setLoading(true)
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
      })
      const { latitude, longitude, accuracy, speed, heading, altitude } = pos.coords
      const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : undefined)
      const body: any = {
        userId: user.id,
        companyId: endpoint.endsWith("punch-in") ? user.companyId : undefined,
        latitude: n(latitude),
        longitude: n(longitude),
        accuracy: n(accuracy),
        speed: n(speed),
        heading: n(heading),
        altitude: n(altitude),
        locationName: "Mobile App",
      }
      const resp = await apiCall(endpoint, { method: "POST", body: JSON.stringify(body) })
      if (resp?.success) {
        useAppStore.getState().setAttendanceStatus(status === "out" ? "in" : "out")
        await fetchDashboardStats()
      }
    } catch (e) {
      console.error("Attendance failed", e)
    } finally {
      setLoading(false)
    }
  }, [user, apiCall, setLoading, fetchDashboardStats])

  const createRecord = useCallback(async (type: string, payload: any) => {
    if (!user) return
    const endpoints: Record<string, string> = {
      task: "/api/daily-tasks",
      pjp: "/api/pjp",
      dealer: "/api/dealers",
      dvr: "/api/dvr",
      tvr: "/api/tvr",
      "dealer-score": "/api/dealer-reports-scores",
      "sales-report": "/api/sales-reports",
      "collection-report": "/api/collection-reports",
      "dealer-brand-mapping": "/api/dealer-brand-mapping",
      "ddp": "/api/ddp",
      "leave-application": "/api/leave-applications",
    }
    const resp = await apiCall(endpoints[type], { method: "POST", body: JSON.stringify({ ...payload, userId: user.id }) })
    if (resp?.success) await fetchAllData()
    return resp
  }, [user, apiCall, fetchAllData])

  const updateRecord = useCallback(async (type: string, id: string, payload: any) => {
    const endpoints: Record<string, (id: string) => string> = {
      task: (id) => `/api/daily-tasks/${id}`,
      pjp: (id) => `/api/pjp/${id}`,
      dealer: (id) => `/api/dealers/${id}`,
      dvr: (id) => `/api/dvr/${id}`,
      tvr: (id) => `/api/tvr/${id}`,
      "dealer-score": (id) => `/api/dealer-reports-scores/${id}`,
      "sales-report": (id) => `/api/sales-reports/${id}`,
      "collection-report": (id) => `/api/collection-reports/${id}`,
      "dealer-brand-mapping": (id) => `/api/dealer-brand-mapping/${id}`,
      "ddp": (id) => `/api/ddp/${id}`,
      "leave-application": (id) => `/api/leave-applications/${id}`,
    }
    const resp = await apiCall(endpoints[type](id), { method: "PUT", body: JSON.stringify(payload) })
    if (resp?.success) await fetchAllData()
    return resp
  }, [apiCall, fetchAllData])

  const deleteRecord = useCallback(async (type: string, id: string) => {
    const endpoints: Record<string, (id: string) => string> = {
      task: (id) => `/api/daily-tasks/${id}`,
      pjp: (id) => `/api/pjp/${id}`,
      dealer: (id) => `/api/dealers/${id}`,
      dvr: (id) => `/api/dvr/${id}`,
      tvr: (id) => `/api/tvr/${id}`,
      "dealer-score": (id) => `/api/dealer-reports-scores/${id}`,
      "sales-report": (id) => `/api/sales-reports/${id}`,
      "collection-report": (id) => `/api/collection-reports/${id}`,
      "dealer-brand-mapping": (id) => `/api/dealer-brand-mapping/${id}`,
      "ddp": (id) => `/api/ddp/${id}`,
      "leave-application": (id) => `/api/leave-applications/${id}`,
    }
    const resp = await apiCall(endpoints[type](id), { method: "DELETE" })
    if (resp?.success) await fetchAllData()
    return resp
  }, [apiCall, fetchAllData])

  const handleLogout = useCallback(() => {
    localStorage.removeItem("user")
    useAppStore.getState().setUser(null)
  }, [])

  return { fetchAllData, fetchDashboardStats, handleAttendance, createRecord, updateRecord, deleteRecord, handleLogout }
}

// --------------------
// Reusable UI
// --------------------
const StatusBar = () => {
  const { isOnline, lastSync } = useAppStore()
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-background/95 backdrop-blur border-b">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-red-500"}`} />
        <span className="text-xs font-medium text-muted-foreground">{isOnline ? "Online" : "Offline"}</span>
      </div>
      {lastSync && (
        <span className="text-xs text-muted-foreground">Last sync: {lastSync.toLocaleTimeString()}</span>
      )}
    </div>
  )
}

const LoadingList = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <Card key={i} className="bg-card/50 border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
)

const StatCard = ({ label, value, Icon, gradient }: { label: string; value: number; Icon: any; gradient: string }) => (
  <Card className="bg-card/80 border-0 shadow-sm hover:shadow-md transition-all duration-200">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold tracking-tight mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${gradient} shadow-sm`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
)

const StatTile = ({ icon: Icon, value, label, tint }: { icon: any; value: number; label: string; tint: string }) => (
  <Card className="bg-card/60 border-0 shadow-sm">
    <CardContent className="p-4 text-center">
      <Icon className={`h-8 w-8 mx-auto mb-2 ${tint}`} />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent>
  </Card>
)

// --------------------
// Main Component
// --------------------
export default function CRMDashboard() {
  const {
    user,
    currentPage,
    attendanceStatus,
    isLoading,
    dailyTasks,
    pjps,
    dealers,
    reports,
    salesReports,
    collectionReports,
    dealerBrandMappings,
    ddpReports,
    leaveApplications,
    brands,
    userTargets,
    dashboardStats,
    showCreateModal,
    createType,
    setUser,
    setCurrentPage,
    setUIState,
    resetModals,
  } = useAppStore()

  const { fetchAllData, handleAttendance, createRecord, updateRecord, deleteRecord, handleLogout } = useAPI()

  // boot
  useEffect(() => {
    const s = localStorage.getItem("user")
    if (s) setUser(JSON.parse(s))
  }, [setUser])

  useEffect(() => {
    if (user) fetchAllData()
  }, [user, fetchAllData])

  // memo slices
  const filteredTasks = useMemo(() => (dailyTasks || []).filter((t) => t.status !== "Completed").slice(0, 5), [dailyTasks])
  const activePJPs = useMemo(() => (pjps || []).filter((p: any) => ["active", "planned"].includes(String(p.status))).slice(0, 5), [pjps])
  const recentReports = useMemo(() => (reports || []).slice(0, 3), [reports])
  const recentSalesReports = useMemo(() => (salesReports || []).slice(0, 3), [salesReports])
  const recentCollectionReports = useMemo(() => (collectionReports || []).slice(0, 3), [collectionReports])

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Please Login</h2>
            <p className="text-muted-foreground">You need to login to access the CRM dashboard.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-screen max-w-md mx-auto flex flex-col bg-background text-foreground overflow-hidden">
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {currentPage === "home" && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }} 
              className="flex-1 flex flex-col"
            >
              <StatusBar />

              <ScrollArea className="flex-1">
                {/* Header */}
                <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-background">
                  <div className="px-6 py-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20 shadow-md">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold">
                            {user?.firstName?.[0]}
                            {user?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h1 className="text-xl font-bold">
                            {user?.firstName} {user?.lastName}
                          </h1>
                          <p className="text-sm text-muted-foreground">{user?.company?.companyName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button 
                          variant={attendanceStatus === "in" ? "destructive" : "default"} 
                          size="sm"
                          onClick={handleAttendance} 
                          className="rounded-full shadow-sm"
                          disabled={isLoading}
                        >
                          {attendanceStatus === "in" ? (
                            <><LogOut className="h-4 w-4 mr-1" /> Out</>
                          ) : (
                            <><LogIn className="h-4 w-4 mr-1" /> In</>
                          )}
                        </Button>
                        <Button variant="outline" size="icon" className="rounded-full">
                          <Bell className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard 
                        label="Today's Tasks" 
                        value={filteredTasks.length} 
                        Icon={CheckCircle} 
                        gradient="bg-gradient-to-br from-blue-500 to-blue-600" 
                      />
                      <StatCard 
                        label="Active PJPs" 
                        value={activePJPs.length} 
                        Icon={Navigation} 
                        gradient="bg-gradient-to-br from-purple-500 to-purple-600" 
                      />
                      <StatCard 
                        label="Total Dealers" 
                        value={(dealers || []).length} 
                        Icon={Building2} 
                        gradient="bg-gradient-to-br from-orange-500 to-orange-600" 
                      />
                      <StatCard 
                        label="Reports" 
                        value={(reports || []).length + (salesReports || []).length + (collectionReports || []).length} 
                        Icon={BarChart3} 
                        gradient="bg-gradient-to-br from-emerald-500 to-emerald-600" 
                      />
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="px-6 py-6 space-y-8 pb-32">
                  {/* Quick Actions */}
                  <div>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Plus className="h-5 w-5 text-primary" />
                      Quick Actions
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        variant="outline" 
                        className="h-16 flex-col gap-2 bg-card/50 border-0 shadow-sm"
                        onClick={() => { setUIState("createType", "dvr"); setUIState("showCreateModal", true) }}
                      >
                        <FileText className="h-5 w-5" />
                        <span className="text-xs">Create DVR</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-16 flex-col gap-2 bg-card/50 border-0 shadow-sm"
                        onClick={() => { setUIState("createType", "sales-report"); setUIState("showCreateModal", true) }}
                      >
                        <TrendingUp className="h-5 w-5" />
                        <span className="text-xs">Sales Report</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-16 flex-col gap-2 bg-card/50 border-0 shadow-sm"
                        onClick={() => { setUIState("createType", "collection-report"); setUIState("showCreateModal", true) }}
                      >
                        <DollarSign className="h-5 w-5" />
                        <span className="text-xs">Collection</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-16 flex-col gap-2 bg-card/50 border-0 shadow-sm"
                        onClick={() => { setUIState("createType", "ddp"); setUIState("showCreateModal", true) }}
                      >
                        <Package className="h-5 w-5" />
                        <span className="text-xs">DDP</span>
                      </Button>
                    </div>
                  </div>

                  {/* Tasks Section */}
                  <Section 
                    title="Today's Tasks" 
                    Icon={CheckCircle} 
                    onAdd={() => { setUIState("createType", "task"); setUIState("showCreateModal", true) }}
                  >
                    {isLoading ? (
                      <LoadingList rows={3} />
                    ) : filteredTasks.length ? (
                      <div className="space-y-3">
                        {filteredTasks.map((task: any, i: number) => (
                          <TaskCard 
                            key={task.id ?? i} 
                            task={task} 
                            onEdit={(t) => { setUIState("selectedItem", t); setUIState("createType", "task"); setUIState("showCreateModal", true) }} 
                            onDelete={(id) => deleteRecord("task", id)} 
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty icon={CheckCircle} label="No tasks for today" />
                    )}
                  </Section>

                  {/* Reports Section */}
                  <Section 
                    title="Recent Reports" 
                    Icon={FileText} 
                    onAdd={() => { setUIState("createType", "dvr"); setUIState("showCreateModal", true) }}
                  >
                    <Tabs defaultValue="daily" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="daily">Daily</TabsTrigger>
                        <TabsTrigger value="sales">Sales</TabsTrigger>
                        <TabsTrigger value="collection">Collection</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="daily" className="space-y-3 mt-4">
                        {recentReports.length ? (
                          recentReports.map((r: any, i: number) => (
                            <ReportCard 
                              key={r.id ?? i} 
                              report={r} 
                              type="daily"
                              onView={(rr) => { setUIState("selectedItem", rr); setUIState("showDetailModal", true) }} 
                            />
                          ))
                        ) : (
                          <Empty icon={FileText} label="No daily reports yet" />
                        )}
                      </TabsContent>
                      
                      <TabsContent value="sales" className="space-y-3 mt-4">
                        {recentSalesReports.length ? (
                          recentSalesReports.map((r: any, i: number) => (
                            <ReportCard 
                              key={r.id ?? i} 
                              report={r} 
                              type="sales"
                              onView={(rr) => { setUIState("selectedItem", rr); setUIState("showDetailModal", true) }} 
                            />
                          ))
                        ) : (
                          <Empty icon={TrendingUp} label="No sales reports yet" />
                        )}
                      </TabsContent>
                      
                      <TabsContent value="collection" className="space-y-3 mt-4">
                        {recentCollectionReports.length ? (
                          recentCollectionReports.map((r: any, i: number) => (
                            <ReportCard 
                              key={r.id ?? i} 
                              report={r} 
                              type="collection"
                              onView={(rr) => { setUIState("selectedItem", rr); setUIState("showDetailModal", true) }} 
                            />
                          ))
                        ) : (
                          <Empty icon={DollarSign} label="No collection reports yet" />
                        )}
                      </TabsContent>
                    </Tabs>
                  </Section>

                  {/* Journey Plans */}
                  <Section 
                    title="Journey Plans" 
                    Icon={Navigation} 
                    onAdd={() => { setUIState("createType", "pjp"); setUIState("showCreateModal", true) }}
                  >
                    {isLoading ? (
                      <LoadingList rows={3} />
                    ) : activePJPs.length ? (
                      <div className="space-y-3">
                        {activePJPs.map((pjp: any, i: number) => (
                          <PJPCard 
                            key={pjp.id ?? i} 
                            pjp={pjp} 
                            onView={(p) => { setUIState("selectedItem", p); setUIState("showDetailModal", true) }} 
                            onEdit={(p) => { setUIState("selectedItem", p); setUIState("createType", "pjp"); setUIState("showCreateModal", true) }} 
                            onDelete={(id) => deleteRecord("pjp", id)} 
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty icon={Navigation} label="No active journey plans" />
                    )}
                  </Section>

                  {/* Dealers */}
                  <Section 
                    title="Recent Dealers" 
                    Icon={Building2} 
                    onAdd={() => { setUIState("createType", "dealer"); setUIState("showCreateModal", true) }}
                  >
                    {isLoading ? (
                      <LoadingList rows={3} />
                    ) : (dealers || []).length ? (
                      <div className="space-y-3">
                        {(dealers || []).slice(0, 5).map((dealer: any, i: number) => (
                          <DealerCard 
                            key={dealer.id ?? i} 
                            dealer={dealer} 
                            onView={(d) => { setUIState("selectedItem", d); setUIState("showDetailModal", true) }} 
                            onEdit={(d) => { setUIState("selectedItem", d); setUIState("createType", "dealer"); setUIState("showCreateModal", true) }} 
                            onDelete={(id) => deleteRecord("dealer", id)}
                            onScore={(d) => { setUIState("selectedItem", d); setUIState("createType", "dealer-score"); setUIState("showCreateModal", true) }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Empty icon={Building2} label="No dealers yet" />
                        <Button 
                          className="mt-3" 
                          onClick={() => { setUIState("createType", "dealer"); setUIState("showCreateModal", true) }}
                        >
                          <Plus className="h-4 w-4 mr-2" /> Add First Dealer
                        </Button>
                      </div>
                    )}
                  </Section>
                </div>
              </ScrollArea>

              <BottomNav current={currentPage} onChange={setCurrentPage} />
            </motion.div>
          )}

          {currentPage === "profile" && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }} 
              className="flex-1 flex flex-col"
            >
              <StatusBar />
              
              <ScrollArea className="flex-1">
                <div className="px-6 py-6 pb-32">
                  {/* Profile Header */}
                  <div className="text-center mb-8">
                    <Avatar className="h-24 w-24 mx-auto ring-4 ring-primary/20 shadow-lg">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-2xl font-bold">
                        {user?.firstName?.[0]}
                        {user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <h2 className="text-2xl font-bold mt-4">{user?.firstName} {user?.lastName}</h2>
                    <p className="text-muted-foreground">{user?.email}</p>
                    <Badge className="mt-2" variant="secondary">{user?.role ?? "User"}</Badge>
                  </div>

                  {/* Stats Overview */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <StatTile 
                      icon={FileText} 
                      value={(reports || []).length + (salesReports || []).length + (collectionReports || []).length} 
                      label="Total Reports" 
                      tint="text-blue-500" 
                    />
                    <StatTile 
                      icon={Building2} 
                      value={(dealers || []).length} 
                      label="Dealers Managed" 
                      tint="text-orange-500" 
                    />
                    <StatTile 
                      icon={Navigation} 
                      value={(pjps || []).length} 
                      label="Journey Plans" 
                      tint="text-purple-500" 
                    />
                    <StatTile 
                      icon={CheckCircle} 
                      value={(dailyTasks || []).filter(t => t.status === "Completed").length} 
                      label="Completed Tasks" 
                      tint="text-emerald-500" 
                    />
                  </div>

                  {/* Performance Section */}
                  <Card className="mb-8 border-0 shadow-sm bg-card/60">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-yellow-500" />
                        Performance Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {dashboardStats?.attendance && (
                          <div>
                            <div className="flex items-center justify-between text-sm mb-2">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-500" />
                                <span>Today's Attendance</span>
                              </div>
                              <Badge variant={dashboardStats.attendance.isPresent ? "default" : "secondary"}>
                                {dashboardStats.attendance.isPresent ? "Present" : "Absent"}
                              </Badge>
                            </div>
                            {dashboardStats.attendance.punchInTime && (
                              <p className="text-xs text-muted-foreground ml-6">
                                Punch In: {new Date(dashboardStats.attendance.punchInTime).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                        )}

                        {(userTargets || []).map((target: any, idx: number) => {
                          const progress = Math.min(100, Math.round(((target.current ?? 0) / (target.target || 1)) * 100))
                          const barColor = progress >= 80 ? "bg-emerald-500" : progress >= 60 ? "bg-yellow-500" : "bg-red-500"
                          const Icon = target.icon || Target
                          
                          return (
                            <div key={`${target.label}-${idx}`} className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Icon className={`h-4 w-4 ${target.color || "text-muted-foreground"}`} />
                                  <span>{target.label}</span>
                                </div>
                                <span className="font-mono text-xs">{target.current} / {target.target}</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }} 
                                  animate={{ width: `${progress}%` }} 
                                  transition={{ duration: 0.8, delay: idx * 0.1 }} 
                                  className={`h-full ${barColor}`} 
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent PJPs */}
                  <Card className="mb-8 border-0 shadow-sm bg-card/60">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Navigation className="h-5 w-5 text-purple-500" />
                        Recent Journey Plans
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(pjps || []).slice(0, 5).length ? (
                        <div className="space-y-3">
                          {(pjps || []).slice(0, 5).map((pjp: any, i: number) => (
                            <div key={pjp.id ?? i} className="p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium text-sm">{pjp.objective}</h4>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {pjp.siteName || pjp.location}
                                  </p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="text-xs">
                                      {pjp.status}
                                    </Badge>
                                    {pjp.planDate && (
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(pjp.planDate).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => { setUIState("selectedItem", pjp); setUIState("showDetailModal", true) }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty icon={Navigation} label="No journey plans yet" />
                      )}
                    </CardContent>
                  </Card>

                  {/* Settings & Actions */}
                  <div className="space-y-3">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-3 h-12 bg-card/50 border-0"
                      onClick={() => { setUIState("createType", "leave-application"); setUIState("showCreateModal", true) }}
                    >
                      <ClipboardList className="h-5 w-5" />
                      Apply for Leave
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-3 h-12 bg-card/50 border-0"
                      onClick={() => { setUIState("createType", "dealer-brand-mapping"); setUIState("showCreateModal", true) }}
                    >
                      <Package className="h-5 w-5" />
                      Manage Brand Mapping
                    </Button>

                    <Separator className="my-4" />

                    <Button 
                      variant="destructive" 
                      className="w-full gap-3 h-12 shadow-sm" 
                      onClick={handleLogout}
                    >
                      <LogOut className="h-5 w-5" />
                      Logout
                    </Button>
                  </div>
                </div>
              </ScrollArea>

              <BottomNav current={currentPage} onChange={setCurrentPage} />
            </motion.div>
          )}

          {currentPage === "ai" && (
            <motion.div 
              key="ai"
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="h-full"
            >
              <ChatInterface onBack={() => setCurrentPage("home")} />
            </motion.div>
          )}

          {currentPage === "journey" && (
            <motion.div 
              key="journey"
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="h-full"
            >
              <JourneyTracker 
                userId={user?.id || 1} 
                onBack={() => setCurrentPage("home")} 
                onJourneyEnd={() => { 
                  fetchAllData(); 
                  setCurrentPage("home") 
                }} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showCreateModal && (
        <CreateModal 
          type={createType} 
          onClose={resetModals} 
          onCreate={createRecord} 
        />
      )}
    </div>
  )
}

// --------------------
// Section Component
// --------------------
function Section({ title, Icon, children, onAdd }: { 
  title: string; 
  Icon: any; 
  children: React.ReactNode; 
  onAdd: () => void 
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <Button 
          size="icon" 
          className="rounded-full h-8 w-8 shadow-sm" 
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {children}
    </div>
  )
}

// --------------------
// Card Components
// --------------------
function Empty({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="h-12 w-12 mx-auto opacity-40 mb-3" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

function TaskCard({ task, onEdit, onDelete }: { 
  task: any; 
  onEdit: (t: any) => void; 
  onDelete: (id: string) => void 
}) {
  return (
    <Card className="bg-card/80 border-0 shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-medium">{task.visitType || task.title}</h3>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
            )}
            <div className="flex items-center flex-wrap gap-2 mt-3">
              <Badge 
                variant={task.priority === "high" ? "destructive" : "outline"}
                className="text-xs"
              >
                {task.priority || "Normal"}
              </Badge>
              {task.taskDate && (
                <span className="text-xs text-muted-foreground">
                  {new Date(task.taskDate).toLocaleDateString()}
                </span>
              )}
              {task.pjpId && <Badge variant="secondary" className="text-xs">PJP</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <IconBtn onClick={() => onEdit(task)} Icon={Edit} />
            <IconBtn onClick={() => onDelete(String(task.id))} Icon={Trash2} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PJPCard({ pjp, onView, onEdit, onDelete }: { 
  pjp: any; 
  onView: (p: any) => void; 
  onEdit: (p: any) => void; 
  onDelete: (id: string) => void 
}) {
  return (
    <Card className="bg-card/80 border-0 shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 cursor-pointer" onClick={() => onView(pjp)}>
            <h3 className="font-medium">{pjp.objective}</h3>
            <p className="text-sm text-muted-foreground mt-1">{pjp.siteName || pjp.location}</p>
            <div className="flex items-center flex-wrap gap-2 mt-3">
              <Badge variant="outline" className="text-xs">{pjp.status}</Badge>
              {pjp.planDate && (
                <span className="text-xs text-muted-foreground">
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
          <div className="flex items-center gap-1">
            <IconBtn onClick={() => onView(pjp)} Icon={Eye} />
            <IconBtn onClick={() => onEdit(pjp)} Icon={Edit} />
            <IconBtn onClick={() => onDelete(String(pjp.id))} Icon={Trash2} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DealerCard({ dealer, onView, onEdit, onDelete, onScore }: { 
  dealer: any; 
  onView: (d: any) => void; 
  onEdit: (d: any) => void; 
  onDelete: (id: string) => void;
  onScore: (d: any) => void;
}) {
  return (
    <Card className="bg-card/80 border-0 shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 cursor-pointer" onClick={() => onView(dealer)}>
            <h3 className="font-medium">{dealer.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {dealer.region} {dealer.area ? `- ${dealer.area}` : ""}
            </p>
            <div className="flex items-center flex-wrap gap-2 mt-3">
              {dealer.type && <Badge variant="outline" className="text-xs">{dealer.type}</Badge>}
              {dealer.totalPotential && (
                <span className="text-xs text-emerald-600 font-medium">
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
          <div className="flex items-center gap-1">
            <IconBtn onClick={() => onScore(dealer)} Icon={Star} />
            <IconBtn onClick={() => onView(dealer)} Icon={Eye} />
            <IconBtn onClick={() => onEdit(dealer)} Icon={Edit} />
            <IconBtn onClick={() => onDelete(String(dealer.id))} Icon={Trash2} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ReportCard({ report, type, onView }: { 
  report: any; 
  type: "daily" | "sales" | "collection";
  onView: (r: any) => void 
}) {
  const getIcon = () => {
    switch (type) {
      case "sales": return TrendingUp
      case "collection": return DollarSign
      default: return FileText
    }
  }

  const getTitle = () => {
    switch (type) {
      case "sales": return `Sales Report - ${report.dealerId || 'N/A'}`
      case "collection": return `Collection - ₹${Number(report.collectedAmount || 0).toLocaleString()}`
      default: return report.title || "Daily Report"
    }
  }

  const getSubtitle = () => {
    switch (type) {
      case "sales": return `Target: ₹${Number(report.monthlyTarget || 0).toLocaleString()}`
      case "collection": return `Dealer: ${report.dealerId}`
      default: return report.location || "Field Visit"
    }
  }

  const Icon = getIcon()

  return (
    <Card className="bg-card/80 border-0 shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 cursor-pointer" onClick={() => onView(report)}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm">{getTitle()}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{getSubtitle()}</p>
            <div className="flex items-center flex-wrap gap-2 mt-3">
              <Badge variant="outline" className="text-xs">{type.toUpperCase()}</Badge>
              {report.date && (
                <span className="text-xs text-muted-foreground">
                  {new Date(report.date).toLocaleDateString()}
                </span>
              )}
              {(report.amount || report.tillDateAchievement) && (
                <span className="text-xs text-emerald-600 font-medium">
                  ₹{Number(report.amount || report.tillDateAchievement || 0).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <IconBtn onClick={() => onView(report)} Icon={Eye} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function IconBtn({ onClick, Icon, tooltip }: { 
  onClick: () => void; 
  Icon: any; 
  tooltip?: string 
}) {
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-8 w-8 rounded-full hover:bg-muted" 
      onClick={onClick} 
      title={tooltip}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}

function BottomNav({ current, onChange }: { 
  current: string; 
  onChange: (k: "home" | "ai" | "journey" | "profile") => void 
}) {
  const items = [
    { key: "home", icon: Home, label: "Home" },
    { key: "ai", icon: MessageCircle, label: "AI" },
    { key: "journey", icon: MapPin, label: "Journey" },
    { key: "profile", icon: User, label: "Profile" },
  ] as const

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t shadow-lg">
      <div className="flex items-center justify-around py-2 px-4">
        {items.map((item) => (
          <Button 
            key={item.key} 
            variant={current === item.key ? "default" : "ghost"} 
            className={`flex flex-col gap-1 rounded-2xl min-w-[64px] h-16 ${
              current === item.key 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "hover:bg-muted"
            }`}
            onClick={() => onChange(item.key)}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs font-medium">{item.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

// --------------------
// Create Modal
// --------------------
function CreateModal({ type, onClose, onCreate }: { 
  type: string; 
  onClose: () => void; 
  onCreate: (type: string, data: any) => Promise<any> 
}) {
  const [form, setForm] = useState<any>({})
  const [submitting, setSubmitting] = useState(false)
  const { pjps, dealers, brands, selectedItem } = useAppStore()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      let payload = { ...form }
      
      if (type === "sales-report") {
        payload = {
          date: form.date || new Date().toISOString().split('T')[0],
          monthlyTarget: Number(form.monthlyTarget || 0),
          tillDateAchievement: Number(form.tillDateAchievement || 0),
          yesterdayTarget: Number(form.yesterdayTarget || 0),
          yesterdayAchievement: Number(form.yesterdayAchievement || 0),
          dealerId: form.dealerId,
        }
      }
      
      if (type === "collection-report") {
        payload = {
          dealerId: form.dealerId,
          collectedAmount: Number(form.collectedAmount || 0),
          collectedOnDate: form.collectedOnDate || new Date().toISOString().split('T')[0],
          weeklyTarget: Number(form.weeklyTarget || 0),
          tillDateAchievement: Number(form.tillDateAchievement || 0),
          yesterdayTarget: Number(form.yesterdayTarget || 0),
          yesterdayAchievement: Number(form.yesterdayAchievement || 0),
        }
      }
      
      if (type === "dealer-brand-mapping") {
        payload = {
          dealerId: form.dealerId,
          brandId: Number(form.brandId),
          capacityMT: Number(form.capacityMT || 0),
        }
      }
      
      if (type === "ddp") {
        payload = {
          dealerId: form.dealerId,
          creationDate: form.creationDate || new Date().toISOString().split('T')[0],
          status: form.status || "Active",
          obstacle: form.obstacle || null,
        }
      }
      
      if (type === "leave-application") {
        payload = {
          startDate: form.startDate,
          endDate: form.endDate,
          leaveType: form.leaveType || "Casual",
          reason: form.reason,
          status: "Pending",
        }
      }
      
      // Existing form handlers...
      if (type === "task") {
        payload = {
          taskDate: form.taskDate || new Date().toISOString().slice(0, 10),
          visitType: form.title || form.visitType || "General Task",
          siteName: form.siteName || "",
          description: form.description || "",
          pjpId: form.isPjp ? form.pjpId : null,
        }
      }
      
      if (type === "pjp") {
        payload = {
          planDate: form.plannedDate,
          visitType: form.visitType || "Field Visit",
          siteName: form.location,
          areaToBeVisited: form.area || form.location,
          objective: form.objective || "",
          expectedOutcome: form.expectedOutcome || "",
          status: "planned",
        }
      }
      
      if (type === "dealer") {
        payload = {
          name: form.name,
          type: form.type,
          region: form.region,
          area: form.area,
          phoneNo: form.phoneNo,
          address: form.address,
          totalPotential: Number(form.totalPotential || 0),
          bestPotential: Number(form.bestPotential || 0),
          brandSelling: form.brandSelling || [],
          remarks: form.remarks || null,
        }
      }
      
      if (type === "dvr" || type === "tvr") {
        payload = {
          type: type.toUpperCase(),
          title: form.title || `${type.toUpperCase()} Report`,
          location: form.location || "",
          amount: Number(form.amount || 0),
          description: form.description || "",
          date: form.date || new Date().toISOString().slice(0, 10),
        }
      }

      await onCreate(type, payload)
      onClose()
    } catch (error) {
      console.error("Form submission error:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const titleMap: Record<string, string> = {
    task: "Create Task",
    pjp: "Create Journey Plan",
    dealer: "Create Dealer",
    dvr: "Create DVR",
    tvr: "Create TVR",
    "dealer-score": "Score Dealer",
    "sales-report": "Create Sales Report",
    "collection-report": "Create Collection Report",
    "dealer-brand-mapping": "Map Brand to Dealer",
    "ddp": "Create DDP",
    "leave-application": "Apply for Leave",
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border bg-card/95 backdrop-blur shadow-xl"
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">{titleMap[type] || "Create"}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <ScrollArea className="max-h-[70vh]">
          <form onSubmit={submit} className="p-6 space-y-4">
            {/* Sales Report Form */}
            {type === "sales-report" && (
              <>
                <Field label="Dealer">
                  <Select value={form.dealerId || ""} onValueChange={(v) => setForm({ ...form, dealerId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      {(dealers || []).map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Report Date">
                  <Input 
                    type="date" 
                    value={form.date || ""} 
                    onChange={(e) => setForm({ ...form, date: e.target.value })} 
                    required 
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Monthly Target (₹)">
                    <Input 
                      type="number" 
                      value={form.monthlyTarget || ""} 
                      onChange={(e) => setForm({ ...form, monthlyTarget: e.target.value })} 
                      required 
                    />
                  </Field>
                  <Field label="Till Date Achievement (₹)">
                    <Input 
                      type="number" 
                      value={form.tillDateAchievement || ""} 
                      onChange={(e) => setForm({ ...form, tillDateAchievement: e.target.value })} 
                      required 
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Yesterday Target (₹)">
                    <Input 
                      type="number" 
                      value={form.yesterdayTarget || ""} 
                      onChange={(e) => setForm({ ...form, yesterdayTarget: e.target.value })} 
                    />
                  </Field>
                  <Field label="Yesterday Achievement (₹)">
                    <Input 
                      type="number" 
                      value={form.yesterdayAchievement || ""} 
                      onChange={(e) => setForm({ ...form, yesterdayAchievement: e.target.value })} 
                    />
                  </Field>
                </div>
              </>
            )}

            {/* Collection Report Form */}
            {type === "collection-report" && (
              <>
                <Field label="Dealer">
                  <Select value={form.dealerId || ""} onValueChange={(v) => setForm({ ...form, dealerId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      {(dealers || []).map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Collected Amount (₹)">
                    <Input 
                      type="number" 
                      value={form.collectedAmount || ""} 
                      onChange={(e) => setForm({ ...form, collectedAmount: e.target.value })} 
                      required 
                    />
                  </Field>
                  <Field label="Collection Date">
                    <Input 
                      type="date" 
                      value={form.collectedOnDate || ""} 
                      onChange={(e) => setForm({ ...form, collectedOnDate: e.target.value })} 
                      required 
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Weekly Target (₹)">
                    <Input 
                      type="number" 
                      value={form.weeklyTarget || ""} 
                      onChange={(e) => setForm({ ...form, weeklyTarget: e.target.value })} 
                    />
                  </Field>
                  <Field label="Till Date Achievement (₹)">
                    <Input 
                      type="number" 
                      value={form.tillDateAchievement || ""} 
                      onChange={(e) => setForm({ ...form, tillDateAchievement: e.target.value })} 
                    />
                  </Field>
                </div>
              </>
            )}

            {/* Dealer Brand Mapping Form */}
            {type === "dealer-brand-mapping" && (
              <>
                <Field label="Dealer">
                  <Select value={form.dealerId || ""} onValueChange={(v) => setForm({ ...form, dealerId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      {(dealers || []).map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Brand">
                  <Select value={form.brandId || ""} onValueChange={(v) => setForm({ ...form, brandId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {(brands || []).map((b: any) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Capacity (MT)">
                  <Input 
                    type="number" 
                    step="0.01"
                    value={form.capacityMT || ""} 
                    onChange={(e) => setForm({ ...form, capacityMT: e.target.value })} 
                    required 
                  />
                </Field>
              </>
            )}

            {/* DDP Form */}
            {type === "ddp" && (
              <>
                <Field label="Dealer">
                  <Select value={form.dealerId || ""} onValueChange={(v) => setForm({ ...form, dealerId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      {(dealers || []).map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Creation Date">
                  <Input 
                    type="date" 
                    value={form.creationDate || ""} 
                    onChange={(e) => setForm({ ...form, creationDate: e.target.value })} 
                    required 
                  />
                </Field>
                <Field label="Status">
                  <Select value={form.status || ""} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Obstacle (if any)">
                  <Textarea 
                    value={form.obstacle || ""} 
                    onChange={(e) => setForm({ ...form, obstacle: e.target.value })} 
                    placeholder="Describe any obstacles..." 
                  />
                </Field>
              </>
            )}

            {/* Leave Application Form */}
            {type === "leave-application" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start Date">
                    <Input 
                      type="date" 
                      value={form.startDate || ""} 
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })} 
                      required 
                    />
                  </Field>
                  <Field label="End Date">
                    <Input 
                      type="date" 
                      value={form.endDate || ""} 
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })} 
                      required 
                    />
                  </Field>
                </div>
                <Field label="Leave Type">
                  <Select value={form.leaveType || ""} onValueChange={(v) => setForm({ ...form, leaveType: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Casual">Casual Leave</SelectItem>
                      <SelectItem value="Sick">Sick Leave</SelectItem>
                      <SelectItem value="Emergency">Emergency Leave</SelectItem>
                      <SelectItem value="Planned">Planned Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Reason">
                  <Textarea 
                    value={form.reason || ""} 
                    onChange={(e) => setForm({ ...form, reason: e.target.value })} 
                    placeholder="Reason for leave..." 
                    required 
                  />
                </Field>
              </>
            )}

            {/* Existing forms for task, pjp, dealer, etc. */}
            {type === "task" && (
              <>
                <Field label="Task Title">
                  <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </Field>
                <Field label="Description">
                  <Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
                <Field label="Task Date">
                  <Input type="date" value={form.taskDate || ""} onChange={(e) => setForm({ ...form, taskDate: e.target.value })} />
                </Field>
                <Field label="Site/Location">
                  <Input value={form.siteName || ""} onChange={(e) => setForm({ ...form, siteName: e.target.value })} placeholder="e.g. Ahmedabad" />
                </Field>
                <div className="flex items-center gap-2">
                  <Switch checked={!!form.isPjp} onCheckedChange={(v) => setForm({ ...form, isPjp: v })} />
                  <Label>This is a PJP task</Label>
                </div>
                {form.isPjp && (
                  <Field label="Related PJP">
                    <Select value={String(form.pjpId || "")} onValueChange={(v) => setForm({ ...form, pjpId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select PJP" /></SelectTrigger>
                      <SelectContent>
                        {(pjps || []).map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.objective}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </>
            )}

            {type === "pjp" && (
              <>
                <Field label="Objective">
                  <Input value={form.objective || ""} onChange={(e) => setForm({ ...form, objective: e.target.value })} required />
                </Field>
                <Field label="Location">
                  <Input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City / Site" />
                </Field>
                <Field label="Area to Visit">
                  <Input value={form.area || ""} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                </Field>
                <Field label="Planned Date">
                  <Input type="date" value={form.plannedDate || ""} onChange={(e) => setForm({ ...form, plannedDate: e.target.value })} required />
                </Field>
                <Field label="Expected Outcome">
                  <Textarea value={form.expectedOutcome || ""} onChange={(e) => setForm({ ...form, expectedOutcome: e.target.value })} />
                </Field>
              </>
            )}

            {type === "dealer" && (
              <>
                <Field label="Dealer Name">
                  <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </Field>
                <Field label="Type">
                  <Select value={form.type || ""} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Premium">Premium</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Basic">Basic</SelectItem>
                      <SelectItem value="Distributor">Distributor</SelectItem>
                      <SelectItem value="Retailer">Retailer</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Phone Number">
                  <Input value={form.phoneNo || ""} onChange={(e) => setForm({ ...form, phoneNo: e.target.value })} required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Region">
                    <Input value={form.region || ""} onChange={(e) => setForm({ ...form, region: e.target.value })} required />
                  </Field>
                  <Field label="Area">
                    <Input value={form.area || ""} onChange={(e) => setForm({ ...form, area: e.target.value })} required />
                  </Field>
                </div>
                <Field label="Full Address">
                  <Textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} required rows={2} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Total Potential (₹)">
                    <Input type="number" value={form.totalPotential || ""} onChange={(e) => setForm({ ...form, totalPotential: e.target.value })} />
                  </Field>
                  <Field label="Best Potential (₹)">
                    <Input type="number" value={form.bestPotential || ""} onChange={(e) => setForm({ ...form, bestPotential: e.target.value })} />
                  </Field>
                </div>
              </>
            )}

            {(type === "dvr" || type === "tvr") && (
              <>
                <Field label="Title">
                  <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </Field>
                <Field label="Location">
                  <Input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount (₹)">
                    <Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </Field>
                  <Field label="Date">
                    <Input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </Field>
                </div>
                <Field label="Description">
                  <Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
              </>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="min-w-[100px]">
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </motion.div>
    </motion.div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  )
}