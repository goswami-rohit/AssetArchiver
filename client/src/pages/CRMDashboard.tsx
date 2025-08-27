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
  userTargets: any[]
  dealerScores: any[]

  showCreateModal: boolean
  createType: "task" | "pjp" | "dealer" | "dvr" | "tvr" | "dealer-score"
  selectedItem: any
  showDetailModal: boolean

  setUser: (u: UserShape | null) => void
  setCurrentPage: (p: AppState["currentPage"]) => void
  setAttendanceStatus: (s: AppState["attendanceStatus"]) => void
  setLoading: (b: boolean) => void
  setOnlineStatus: (b: boolean) => void
  updateLastSync: () => void
  setData: (k: keyof Pick<AppState,
    | "dailyTasks" | "pjps" | "dealers" | "reports" | "userTargets" | "dealerScores"
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
  userTargets: [],
  dealerScores: [],

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
      setData("userTargets" as any, data?.data?.targets || [])
    } catch {}
  }, [user, apiCall, setData])

  const fetchAllData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [tasks, pjps, dealers, dvr] = await Promise.all([
        apiCall(`/api/daily-tasks/user/${user.id}`),
        apiCall(`/api/pjp/user/${user.id}`),
        apiCall(`/api/dealers/user/${user.id}`),
        apiCall(`/api/dvr/user/${user.id}?limit=20`),
      ])
      setData("dailyTasks", tasks?.data ?? [])
      setData("pjps", pjps?.data ?? [])
      setData("dealers", dealers?.data ?? [])
      setData("reports", dvr?.data ?? [])
      await fetchDashboardStats()
    } catch (e) {
      console.error(e)
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
    }
    const resp = await apiCall(endpoints[type](id), { method: "DELETE" })
    if (resp?.success) await fetchAllData()
    return resp
  }, [apiCall, fetchAllData])

  return { fetchAllData, fetchDashboardStats, handleAttendance, createRecord, updateRecord, deleteRecord }
}

// --------------------
// Reusable UI
// --------------------
const StatusBar = () => {
  const { isOnline, lastSync } = useAppStore()
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-red-500"}`} />
        <span className="text-xs text-muted-foreground">{isOnline ? "Online" : "Offline"}</span>
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
      <Card key={i} className="bg-card/50">
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
  <Card className="bg-card/60 hover:bg-card transition-colors">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${gradient}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
)

// --------------------
// Main
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
    userTargets,
    showCreateModal,
    createType,
    setUser,
    setCurrentPage,
    setUIState,
    resetModals,
  } = useAppStore()

  const { fetchAllData, handleAttendance, createRecord, updateRecord, deleteRecord } = useAPI()

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

  return (
    <div className="h-screen max-w-md mx-auto flex flex-col bg-background text-foreground">
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {currentPage === "home" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col">
              <StatusBar />

              <div className="flex-1 overflow-y-auto">
                {/* Header */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/15 to-purple-600/15" />
                  <div className="relative px-6 py-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 ring-2 ring-blue-500/40">
                          <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold">
                            {user?.firstName?.[0]}
                            {user?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h1 className="text-xl font-semibold leading-tight">
                            {user?.firstName} {user?.lastName}
                          </h1>
                          <p className="text-xs text-muted-foreground">{user?.company?.companyName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant={attendanceStatus === "in" ? "destructive" : "default"} onClick={handleAttendance} className="rounded-xl">
                          {attendanceStatus === "in" ? (
                            <><LogOut className="h-4 w-4 mr-2" /> Punch Out</>
                          ) : (
                            <><LogIn className="h-4 w-4 mr-2" /> Punch In</>
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" className="rounded-xl">
                          <Bell className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 mt-5">
                      <StatCard label="Today's Tasks" value={filteredTasks.length} Icon={CheckCircle} gradient="bg-blue-600" />
                      <StatCard label="Active PJPs" value={activePJPs.length} Icon={Calendar} gradient="bg-purple-600" />
                      <StatCard label="Total Dealers" value={(dealers || []).length} Icon={Building2} gradient="bg-orange-600" />
                      <StatCard label="This Month" value={(reports || []).length} Icon={BarChart3} gradient="bg-emerald-600" />
                    </div>
                  </div>
                </div>

                {/* Sections */}
                <div className="px-6 pb-28 space-y-8">
                  <Section title="Today's Tasks" Icon={CheckCircle} onAdd={() => { setUIState("createType", "task"); setUIState("showCreateModal", true) }}>
                    {isLoading ? (
                      <LoadingList rows={3} />
                    ) : filteredTasks.length ? (
                      <AnimatePresence>
                        {filteredTasks.map((task: any, i: number) => (
                          <TaskCard key={task.id ?? i} task={task} onEdit={(t) => { setUIState("selectedItem", t); setUIState("createType", "task"); setUIState("showCreateModal", true) }} onDelete={(id) => deleteRecord("task", id)} />
                        ))}
                      </AnimatePresence>
                    ) : (
                      <Empty icon={CheckCircle} label="No tasks for today" />
                    )}
                  </Section>

                  <Section title="Journey Plans" Icon={Navigation} onAdd={() => { setUIState("createType", "pjp"); setUIState("showCreateModal", true) }}>
                    {isLoading ? (
                      <LoadingList rows={3} />
                    ) : activePJPs.length ? (
                      <AnimatePresence>
                        {activePJPs.map((pjp: any, i: number) => (
                          <PJPCard key={pjp.id ?? i} pjp={pjp} onView={(p) => { setUIState("selectedItem", p); setUIState("showDetailModal", true) }} onEdit={(p) => { setUIState("selectedItem", p); setUIState("createType", "pjp"); setUIState("showCreateModal", true) }} onDelete={(id) => deleteRecord("pjp", id)} />
                        ))}
                      </AnimatePresence>
                    ) : (
                      <Empty icon={Navigation} label="No active journey plans" />
                    )}
                  </Section>

                  <Section title="Recent Dealers" Icon={Building2} onAdd={() => { setUIState("createType", "dealer"); setUIState("showCreateModal", true) }}>
                    {isLoading ? (
                      <LoadingList rows={3} />
                    ) : (dealers || []).length ? (
                      <AnimatePresence>
                        {(dealers || []).slice(0, 5).map((dealer: any, i: number) => (
                          <DealerCard key={dealer.id ?? i} dealer={dealer} onView={(d) => { setUIState("selectedItem", d); setUIState("showDetailModal", true) }} onEdit={(d) => { setUIState("selectedItem", d); setUIState("createType", "dealer"); setUIState("showCreateModal", true) }} onDelete={(id) => deleteRecord("dealer", id)} onScore={(d) => { setUIState("selectedItem", d); setUIState("createType", "dealer-score"); setUIState("showCreateModal", true) }} />
                        ))}
                      </AnimatePresence>
                    ) : (
                      <div className="text-center py-6">
                        <Empty icon={Building2} label="No dealers yet" />
                        <Button className="mt-3" onClick={() => { setUIState("createType", "dealer"); setUIState("showCreateModal", true) }}>
                          <Plus className="h-4 w-4 mr-2" /> Add First Dealer
                        </Button>
                      </div>
                    )}
                  </Section>

                  <Section title="Recent Reports" Icon={FileText} onAdd={() => { setUIState("createType", "dvr"); setUIState("showCreateModal", true) }}>
                    <div className="flex gap-2 mb-3">
                      <Button variant="outline" size="sm" onClick={() => { setUIState("createType", "dvr"); setUIState("showCreateModal", true) }}>
                        <FileText className="h-4 w-4 mr-2" /> Create DVR
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setUIState("createType", "tvr"); setUIState("showCreateModal", true) }}>
                        <BarChart3 className="h-4 w-4 mr-2" /> Create TVR
                      </Button>
                    </div>

                    {recentReports.length ? (
                      <AnimatePresence>
                        {recentReports.map((r: any, i: number) => (
                          <ReportCard key={r.id ?? i} report={r} onView={(rr) => { setUIState("selectedItem", rr); setUIState("showDetailModal", true) }} />
                        ))}
                      </AnimatePresence>
                    ) : (
                      <Empty icon={FileText} label="No reports yet" />
                    )}
                  </Section>
                </div>
              </div>

              {/* Bottom nav */}
              <BottomNav current={currentPage} onChange={(k) => useAppStore.getState().setCurrentPage(k as any)} />
            </motion.div>
          )}

          {currentPage === "profile" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col">
              <StatusBar />
              <div className="flex-1 overflow-y-auto px-6 py-6 pb-28">
                <div className="text-center mb-6">
                  <Avatar className="h-24 w-24 mx-auto ring-4 ring-blue-500/25">
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-2xl font-bold">
                      {user?.firstName?.[0]}
                      {user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-2xl font-semibold mt-3">{user?.firstName} {user?.lastName}</h2>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <Badge className="mt-2">{user?.role ?? "User"}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <StatTile icon={FileText} value={(reports || []).length} label="Total Reports" tint="text-blue-500" />
                  <StatTile icon={Building2} value={(dealers || []).length} label="Dealers Managed" tint="text-orange-500" />
                </div>

                <Card className="bg-card/60 mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-yellow-500" /> Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(userTargets || []).map((t: any, idx: number) => {
                        const progress = Math.min(100, Math.round(((t.current ?? 0) / (t.target || 1)) * 100))
                        const bar = progress >= 80 ? "bg-emerald-500" : progress >= 60 ? "bg-yellow-500" : "bg-red-500"
                        const Icon = t.icon || Target
                        return (
                          <div key={`${t.label}-${idx}`} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2"><Icon className={`h-4 w-4 ${t.color || "text-muted-foreground"}`} /><span>{t.label}</span></div>
                              <span className="tabular-nums">{t.current} / {t.target}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8, delay: idx * 0.1 }} className={`h-full ${bar}`} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Button variant="destructive" className="w-full" onClick={() => { localStorage.removeItem("user"); useAppStore.getState().setUser(null) }}>
                  <LogOut className="h-4 w-4 mr-2" /> Logout
                </Button>
              </div>
              <BottomNav current={currentPage} onChange={(k) => useAppStore.getState().setCurrentPage(k as any)} />
            </motion.div>
          )}

          {currentPage === "ai" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <ChatInterface onBack={() => useAppStore.getState().setCurrentPage("home") } />
            </motion.div>
          )}

          {currentPage === "journey" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <JourneyTracker userId={user?.id || 1} onBack={() => useAppStore.getState().setCurrentPage("home")} onJourneyEnd={() => { useAPI().fetchAllData(); useAppStore.getState().setCurrentPage("home") }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showCreateModal && (
        <CreateModal type={createType} onClose={resetModals} onCreate={createRecord} />
      )}
    </div>
  )
}

// --------------------
// Sections & Cards
// --------------------
function Section({ title, Icon, children, onAdd }: { title: string; Icon: any; children: React.ReactNode; onAdd: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <Button size="icon" className="rounded-full" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Empty({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="text-center py-6 text-muted-foreground">
      <Icon className="h-10 w-10 mx-auto opacity-50 mb-2" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

function TaskCard({ task, onEdit, onDelete }: { task: any; onEdit: (t: any) => void; onDelete: (id: string) => void }) {
  return (
    <Card className="bg-card/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-medium">{task.visitType || task.title}</h3>
            {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
            <div className="flex items-center flex-wrap gap-2 mt-2">
              <Badge variant={task.priority === "high" ? "destructive" : "outline"}>{task.priority || "Normal"}</Badge>
              {task.taskDate && <span className="text-xs text-muted-foreground">{task.taskDate}</span>}
              {task.pjpId && <Badge variant="outline">PJP</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <IconBtn onClick={() => onEdit(task)} Icon={Edit} tooltip="Edit" />
            <IconBtn onClick={() => onDelete(String(task.id))} Icon={Trash2} tooltip="Delete" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PJPCard({ pjp, onView, onEdit, onDelete }: { pjp: any; onView: (p: any) => void; onEdit: (p: any) => void; onDelete: (id: string) => void }) {
  return (
    <Card className="bg-card/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 cursor-pointer" onClick={() => onView(pjp)}>
            <h3 className="font-medium">{pjp.objective}</h3>
            <p className="text-sm text-muted-foreground mt-1">{pjp.siteName || pjp.location}</p>
            <div className="flex items-center flex-wrap gap-2 mt-2">
              <Badge variant="outline">{pjp.status}</Badge>
              {pjp.planDate && <span className="text-xs text-muted-foreground">{pjp.planDate}</span>}
              {pjp.areaToBeVisited && <span className="text-xs text-muted-foreground">📍 {pjp.areaToBeVisited}</span>}
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

function DealerCard({ dealer, onView, onEdit, onDelete, onScore }: { dealer: any; onView: (d: any) => void; onEdit: (d: any) => void; onDelete: (id: string) => void; onScore: (d: any) => void }) {
  return (
    <Card className="bg-card/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 cursor-pointer" onClick={() => onView(dealer)}>
            <h3 className="font-medium">{dealer.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{dealer.region} {dealer.area ? `- ${dealer.area}` : ""}</p>
            <div className="flex items-center flex-wrap gap-2 mt-2">
              {dealer.type && <Badge variant="outline">{dealer.type}</Badge>}
              {dealer.totalPotential && <span className="text-xs text-muted-foreground">₹{dealer.totalPotential}</span>}
              {dealer.phoneNo && <span className="text-xs text-muted-foreground">{dealer.phoneNo}</span>}
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

function ReportCard({ report, onView }: { report: any; onView: (r: any) => void }) {
  return (
    <Card className="bg-card/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 cursor-pointer" onClick={() => onView(report)}>
            <h3 className="font-medium">{report.title || "Daily Report"}</h3>
            <p className="text-sm text-muted-foreground mt-1">{report.location || "Field Visit"}</p>
            <div className="flex items-center flex-wrap gap-2 mt-2">
              <Badge variant="outline">{report.type || "DVR"}</Badge>
              {report.date && <span className="text-xs text-muted-foreground">{report.date}</span>}
              {report.amount && <span className="text-xs text-green-600">₹{report.amount}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1"><IconBtn onClick={() => onView(report)} Icon={Eye} /></div>
        </div>
      </CardContent>
    </Card>
  )
}

function IconBtn({ onClick, Icon, tooltip }: { onClick: () => void; Icon: any; tooltip?: string }) {
  return (
    <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={onClick} title={tooltip}>
      <Icon className="h-4 w-4" />
    </Button>
  )
}

function BottomNav({ current, onChange }: { current: string; onChange: (k: string) => void }) {
  const items = [
    { key: "home", icon: Home, label: "Home" },
    { key: "ai", icon: MessageCircle, label: "AI" },
    { key: "journey", icon: MapPin, label: "Journey" },
    { key: "profile", icon: User, label: "Profile" },
  ]
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t">
      <div className="flex items-center justify-around py-3 px-4">
        {items.map((it) => (
          <Button key={it.key} variant={current === it.key ? "default" : "ghost"} className="flex flex-col gap-1 rounded-2xl min-w-[64px]" onClick={() => onChange(it.key)}>
            <it.icon className="h-5 w-5" />
            <span className="text-xs">{it.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

// --------------------
// Create Modal (Task/PJP/Dealer/DVR/TVR minimal, shadcn-styled)
// --------------------
function CreateModal({ type, onClose, onCreate }: { type: string; onClose: () => void; onCreate: (type: string, data: any) => Promise<any> }) {
  const [form, setForm] = useState<any>({})
  const [submitting, setSubmitting] = useState(false)
  const { pjps, selectedItem } = useAppStore()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      let payload = { ...form }
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
    } finally {
      setSubmitting(false)
    }
  }

  const TitleMap: Record<string, string> = {
    task: "Create Task",
    pjp: "Create PJP",
    dealer: "Create Dealer",
    dvr: "Create DVR",
    tvr: "Create TVR",
    "dealer-score": "Score Dealer",
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-2xl border bg-card/95 backdrop-blur p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{TitleMap[type] || "Create"}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {type === "task" && (
            <>
              <Field label="Task Title">
                <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </Field>
              <Field label="Description"><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
              <Field label="Task Date"><Input type="date" value={form.taskDate || ""} onChange={(e) => setForm({ ...form, taskDate: e.target.value })} /></Field>
              <Field label="Site/Location"><Input value={form.siteName || ""} onChange={(e) => setForm({ ...form, siteName: e.target.value })} placeholder="e.g. Ahmedabad" /></Field>
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
              <Field label="Objective"><Input value={form.objective || ""} onChange={(e) => setForm({ ...form, objective: e.target.value })} required /></Field>
              <Field label="Location"><Input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City / Site" /></Field>
              <Field label="Area to Visit"><Input value={form.area || ""} onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
              <Field label="Planned Date"><Input type="date" value={form.plannedDate || ""} onChange={(e) => setForm({ ...form, plannedDate: e.target.value })} required /></Field>
              <Field label="Expected Outcome"><Textarea value={form.expectedOutcome || ""} onChange={(e) => setForm({ ...form, expectedOutcome: e.target.value })} /></Field>
            </>
          )}

          {type === "dealer" && (
            <>
              <Field label="Dealer Name"><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
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
              <Field label="Phone Number"><Input value={form.phoneNo || ""} onChange={(e) => setForm({ ...form, phoneNo: e.target.value })} required /></Field>
              <Field label="Region"><Input value={form.region || ""} onChange={(e) => setForm({ ...form, region: e.target.value })} required /></Field>
              <Field label="Area"><Input value={form.area || ""} onChange={(e) => setForm({ ...form, area: e.target.value })} required /></Field>
              <Field label="Full Address"><Textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} required rows={2} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Total Potential (₹)"><Input type="number" value={form.totalPotential || ""} onChange={(e) => setForm({ ...form, totalPotential: e.target.value })} /></Field>
                <Field label="Best Potential (₹)"><Input type="number" value={form.bestPotential || ""} onChange={(e) => setForm({ ...form, bestPotential: e.target.value })} /></Field>
              </div>
            </>
          )}

          {(type === "dvr" || type === "tvr") && (
            <>
              <Field label="Title"><Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <Field label="Location"><Input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (₹)"><Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
                <Field label="Date"><Input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              </div>
              <Field label="Description"><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving</> : "Save"}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
