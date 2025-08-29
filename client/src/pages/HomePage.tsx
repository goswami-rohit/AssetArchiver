// src/pages/HomePage.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

//imported forms
import DVRForm from "@/pages/forms/DVRForm";
import TVRForm from "@/pages/forms/TVRForm";
import AttendanceInForm from "@/pages/forms/AttendanceInForm";
import AttendanceOutForm from "@/pages/forms/AttendanceOutForm";
import AddDealerForm from "@/pages/forms/AddDealerForm";
import SalesOrderForm from "@/pages/forms/SalesOrderForm";
import PJPForm from "@/pages/forms/AddPJPForm";

// shared bits you said you exported
import { useAppStore, StatusBar, LoadingList, StatCard } from "@/components/ReusableUI";

/** Local helpers copied/trimmed from the monolith **/
function Empty({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="h-12 w-12 mx-auto opacity-40 mb-3" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function Section({
  title,
  Icon,
  children,
  onAdd,
}: {
  title: string;
  Icon: any;
  children: React.ReactNode;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <Button size="icon" className="rounded-full h-8 w-8 shadow-sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {children}
    </div>
  );
}

function IconBtn({ onClick, Icon, tooltip }: { onClick: () => void; Icon: any; tooltip?: string }) {
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
  );
}

function TaskCard({
  task,
  onEdit,
  onDelete,
}: {
  task: any;
  onEdit: (t: any) => void;
  onDelete: (id: string) => void;
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
              <Badge variant={task.priority === "high" ? "destructive" : "outline"} className="text-xs">
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
  );
}

function PJPCard({
  pjp,
  onView,
  onEdit,
  onDelete,
}: {
  pjp: any;
  onView: (p: any) => void;
  onEdit: (p: any) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="bg-card/80 border-0 shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 cursor-pointer" onClick={() => onView(pjp)}>
            <h3 className="font-medium">{pjp.objective}</h3>
            <p className="text-sm text-muted-foreground mt-1">{pjp.siteName || pjp.location}</p>
            <div className="flex items-center flex-wrap gap-2 mt-3">
              <Badge variant="outline" className="text-xs">
                {pjp.status}
              </Badge>
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
  );
}

function DealerCard({
  dealer,
  onView,
  onEdit,
  onDelete,
  onScore,
}: {
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
  );
}

function ReportCard({
  report,
  type,
  onView,
}: {
  report: any;
  type: "daily" | "sales" | "collection";
  onView: (r: any) => void;
}) {
  const getIcon = () => (type === "sales" ? TrendingUp : type === "collection" ? DollarSign : FileText);
  const getTitle = () =>
    type === "sales"
      ? `Sales Report - ${report.dealerId || "N/A"}`
      : type === "collection"
        ? `Collection - ₹${Number(report.collectedAmount || 0).toLocaleString()}`
        : report.title || "Daily Report";
  const getSubtitle = () =>
    type === "sales"
      ? `Target: ₹${Number(report.monthlyTarget || 0).toLocaleString()}`
      : type === "collection"
        ? `Dealer: ${report.dealerId}`
        : report.location || "Field Visit";

  const Icon = getIcon();

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
              <Badge variant="outline" className="text-xs">
                {type.toUpperCase()}
              </Badge>
              {report.date && (
                <span className="text-xs text-muted-foreground">{new Date(report.date).toLocaleDateString()}</span>
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
  );
}

/** Minimal API helpers (trimmed from old CRMDashboard) **/
const useAPIActions = () => {
  const { updateLastSync, setData, setAttendanceStatus } = useAppStore.getState();
  const apiCall = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(endpoint, {
          headers: { "Content-Type": "application/json", ...(options.headers || {}) },
          signal: controller.signal,
          ...options,
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        updateLastSync();
        return data;
      } finally {
        clearTimeout(timeout);
      }
    },
    [updateLastSync]
  );

  const handleAttendance = useCallback(async () => {
    const { user, attendanceStatus, setLoading } = useAppStore.getState();
    if (!user) return;
    const endpoint = attendanceStatus === "out" ? "/api/attendance/punch-in" : "/api/attendance/punch-out";
    try {
      setLoading(true);
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
      );
      const { latitude, longitude, accuracy, speed, heading, altitude } = pos.coords;
      const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
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
      };
      const resp = await apiCall(endpoint, { method: "POST", body: JSON.stringify(body) });
      if (resp?.success) setAttendanceStatus(attendanceStatus === "out" ? "in" : "out");
    } catch (e) {
      console.error("Attendance failed", e);
    } finally {
      useAppStore.getState().setLoading(false);
    }
  }, [apiCall, setAttendanceStatus]);

  const deleteRecord = useCallback(
    async (type: string, id: string) => {
      const endpoints: Record<string, (id: string) => string> = {
        task: (id) => `/api/daily-tasks/${id}`,
        pjp: (id) => `/api/pjp/${id}`,
        dealer: (id) => `/api/dealers/${id}`,
      };
      try {
        const resp = await apiCall(endpoints[type](id), { method: "DELETE" });
        if (resp?.success) {
          // naive refetch of the list that changed; good enough for now
          const keyMap: Record<string, string> = {
            task: "dailyTasks",
            pjp: "pjps",
            dealer: "dealers",
          };
          // you probably have a dedicated fetchAll; keeping it light here
          setData(keyMap[type] as any, (useAppStore.getState() as any)[keyMap[type]].filter((x: any) => String(x.id) !== id));
        }
        return resp;
      } catch (e) {
        console.error("Delete failed", e);
      }
    },
    [apiCall, setData]
  );

  return { handleAttendance, deleteRecord };
};


export default function HomePage() {
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
    salesReports,
    collectionReports,
    setUIState,
  } = useAppStore();

  const { handleAttendance, deleteRecord } = useAPIActions();

  const filteredTasks = useMemo(
    () => (dailyTasks || []).filter((t: any) => t.status !== "Completed").slice(0, 5),
    [dailyTasks]
  );
  const activePJPs = useMemo(
    () => (pjps || []).filter((p: any) => ["active", "planned"].includes(String(p.status))).slice(0, 5),
    [pjps]
  );
  const recentReports = useMemo(() => (reports || []).slice(0, 3), [reports]);
  const recentSalesReports = useMemo(() => (salesReports || []).slice(0, 3), [salesReports]);
  const recentCollectionReports = useMemo(
    () => (collectionReports || []).slice(0, 3),
    [collectionReports]
  );
  const [openDvr, setOpenDvr] = useState(false);
  const [openTvr, setOpenTvr] = useState(false);
  const [openDealer, setOpenDealer] = useState(false);

  // fetching user details handler
  const [, navigate] = useLocation();

  //attendace hendlers
  const [openIn, setOpenIn] = useState(false);
  const [openOut, setOpenOut] = useState(false);

  // GETTING USER DETAILS TO POPULATE THE USER NAME AND ROLES AT TOP
  // 1) Prime from localStorage once (fast path)
  useEffect(() => {
    if (!user) {
      const raw = localStorage.getItem("user");
      if (raw) {
        try {
          const cached = JSON.parse(raw);
          if (cached && typeof cached === "object" && cached.id) {
            setUser(cached);
          }
        } catch { }
      }
    }
  }, [user, setUser]);

  // 2) Revalidate from server (source of truth)
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (!storedUserId) return;

    const ac = new AbortController();
    fetch(`/api/user/${storedUserId}`, {
      signal: ac.signal,
      credentials: "include", // if you use cookies/sessions
    })
      .then(async (r) => {
        if (r.status === 401) {
          localStorage.removeItem("isAuthenticated");
          localStorage.removeItem("user");
          localStorage.removeItem("userId");
          navigate("/login");
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setUser(data.user);
        // keep cache fresh for next boot
        localStorage.setItem("user", JSON.stringify(data.user));
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error("load /api/user failed:", err);
      });
    return () => ac.abort();
  }, [setUser, navigate]);

  // persist the attendace status on HomePage on page refresh. change only on user clicks
  useEffect(() => {
    const saved = localStorage.getItem("attendanceStatus");
    if (saved === "in" || saved === "out") setAttendanceStatus(saved as "in" | "out");
  }, [setAttendanceStatus]);


  return (
    <div className="min-h-full flex flex-col">
      <StatusBar />

      {/* Header */}
      <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="px-6 py-6">
          {/* Row 1: Logo + Attendance */}
          <div className="flex items-center justify-between">
            <div className="h-12 w-12 overflow-hidden rounded-full shadow-md bg-white/5">
              <img
                src="/BEST_CEMENT_LOGO.webp"   // lives in /public
                alt="Best Cement Logo"
                className="h-full w-full object-contain"
              />
            </div>

            {/*Attendance In and Out section (single button, conditional)*/}
            <div className="flex items-center gap-2">
              {attendanceStatus !== "in" ? (
                // Show "Attendance In"
                <Dialog open={openIn} onOpenChange={setOpenIn}>
                  <DialogTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      className="rounded-full shadow-sm"
                      disabled={isLoading}
                    >
                      <LogIn className="h-4 w-4 mr-1" />
                      Attendance In
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="p-0 w-[100vw] sm:max-w-md h-[90vh] overflow-hidden">
                    <div className="h-full overflow-y-auto p-4">
                      <AttendanceInForm
                        userId={user?.id}
                        onSubmitted={() => {
                          // 1) close dialog
                          setOpenIn(false);
                          // 2) clear focus so no residual click hits new elements
                          (document.activeElement as HTMLElement | null)?.blur?.();
                          // 3) defer the swap one frame to avoid click-through
                          requestAnimationFrame(() => {
                            setAttendanceStatus("in");
                            localStorage.setItem("attendanceStatus", "in");
                          });
                        }}
                        onCancel={() => setOpenIn(false)}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                // Show "Attendance Out"
                <Dialog open={openOut} onOpenChange={setOpenOut}>
                  <DialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-full shadow-sm"
                      disabled={isLoading}
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      Attendance Out
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="p-0 w-[100vw] sm:max-w-md h-[90vh] overflow-hidden">
                    <div className="h-full overflow-y-auto p-4">
                      <AttendanceOutForm
                        userId={user?.id}
                        onSubmitted={() => {
                          setOpenOut(false);
                          (document.activeElement as HTMLElement | null)?.blur?.();
                          requestAnimationFrame(() => {
                            setAttendanceStatus("out");
                            localStorage.setItem("attendanceStatus", "out");
                          });
                        }}
                        onCancel={() => setOpenOut(false)}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

          </div>

          {/* User name + role (and company) */}
          <div className="mt-4 text-center">
            <h1 className="text-xl font-bold leading-tight">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.role ?? "User"}
              {user?.company?.companyName ? ` • ${user.company.companyName}` : ""}
            </p>
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

      {/* Main Content (AppShell provides the scroll; just add bottom padding) */}
      <div className="px-6 py-6 space-y-8 pb-32">

        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Quick Actions
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* DVR */}
            <Dialog modal={false}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-16 flex-col gap-2 bg-card/50 border-0 shadow-sm"
                >
                  <FileText className="h-5 w-5" />
                  <span className="text-xs">Create DVR</span>
                </Button>
              </DialogTrigger>

              <DialogContent
                // mobile-friendly: wide and tall enough, with internal scroll
                className="p-0 sm:max-w-md w-[100vw] sm:w-auto h-[90vh] sm:h-auto overflow-hidden"
              >
                <DialogHeader className="px-4 pt-4 pb-2">
                  <DialogTitle>Daily Visit Report</DialogTitle>
                </DialogHeader>
                <div className="h-full sm:h-auto overflow-y-auto px-4 pb-4">
                  <DVRForm
                    userId={user?.id}
                    onSubmitted={(payload) => {
                      // TODO: POST to API, then:
                      // queryClient.invalidateQueries(/* dashboards */)
                      // Close dialog programmatically if you want:
                      // document.querySelector("[data-dialog-close]")?.click()
                    }}
                    onCancel={() => {
                      // let users close via the X in your form or:
                      // document.querySelector("[data-dialog-close]")?.click()
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>

            {/* TVR */}
            <Dialog modal={false}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-16 flex-col gap-2 bg-card/50 border-0 shadow-sm"
                >
                  <Wrench className="h-5 w-5" />
                  <span className="text-xs">Create TVR</span>
                </Button>
              </DialogTrigger>

              <DialogContent className="p-0 sm:max-w-md w-[100vw] sm:w-auto h-[90vh] sm:h-auto overflow-hidden">
                <DialogHeader className="px-4 pt-4 pb-2">
                  <DialogTitle>Technical Visit Report</DialogTitle>
                </DialogHeader>
                <div className="h-full sm:h-auto overflow-y-auto px-4 pb-4">
                  <TVRForm
                    userId={user?.id}
                    onSubmitted={(payload) => {
                      // TODO: POST to API
                    }}
                    onCancel={() => { }}
                  />
                </div>
              </DialogContent>
            </Dialog>

            {/* Sales Order */}
            <Dialog modal={false}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-16 flex-col gap-2 bg-card/50 border-0 shadow-sm"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span className="text-xs">Create Sales Order</span>
                </Button>
              </DialogTrigger>

              <DialogContent className="p-0 sm:max-w-md w-[100vw] sm:w-auto h-[90vh] sm:h-auto overflow-hidden">
                <DialogHeader className="px-4 pt-4 pb-2">
                  <DialogTitle>Create Sales Order</DialogTitle>
                </DialogHeader>
                <div className="h-full sm:h-auto overflow-y-auto px-4 pb-4">
                  <SalesOrderForm
                    user={user}
                    onSubmitted={(payload) => {
                      // TODO: POST to /api/sales-order/send (SMS + Email)
                      // e.g. await fetch('/api/sales-order/send', { method:'POST', body: JSON.stringify(payload) })
                      // toast.success('Order sent!')
                    }}
                    onCancel={() => { }}
                  />
                </div>
              </DialogContent>
            </Dialog>

            {/* PJP (Self-create) */}
            <Dialog modal={false}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-16 flex-col gap-2 bg-card/50 border-0 shadow-sm"
                >
                  <Route className="h-5 w-5" />
                  <span className="text-xs">Create PJP</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="p-0 sm:max-w-md w-[100vw] sm:w-auto h-[90vh] sm:h-auto overflow-hidden">
                <DialogHeader className="px-4 pt-4 pb-2">
                  <DialogTitle>Permanent Journey Plan</DialogTitle>
                </DialogHeader>
                <div className="h-full sm:h-auto overflow-y-auto px-4 pb-4">
                  <PJPForm
                    user={user ?? null}
                    onSubmitted={(payload) => {
                      // TODO: call POST /api/pjp
                      // then refresh dashboard lists if needed
                    }}
                    onCancel={() => { }}
                  />
                </div>
              </DialogContent>
            </Dialog>

          </div>

        </section>

        {/* Tasks */}
        <Section
          title="Today's Tasks"
          Icon={CheckCircle}
          onAdd={() => {
            setUIState("createType", "task");
            setUIState("showCreateModal", true);
          }}
        >
          {isLoading ? (
            <LoadingList rows={3} />
          ) : filteredTasks.length ? (
            <div className="space-y-3">
              {filteredTasks.map((task: any, i: number) => (
                <TaskCard
                  key={task.id ?? i}
                  task={task}
                  onEdit={(t) => {
                    setUIState("selectedItem", t);
                    setUIState("createType", "task");
                    setUIState("showCreateModal", true);
                  }}
                  onDelete={(id) => deleteRecord("task", id)}
                />
              ))}
            </div>
          ) : (
            <Empty icon={CheckCircle} label="No tasks for today" />
          )}
        </Section>

        {/* Reports */}
        <Section
          title="Recent Reports"
          Icon={FileText}
          onAdd={() => {
            setUIState("createType", "dvr");
            setUIState("showCreateModal", true);
          }}
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
                    onView={(rr) => {
                      setUIState("selectedItem", rr);
                      setUIState("showDetailModal", true);
                    }}
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
                    onView={(rr) => {
                      setUIState("selectedItem", rr);
                      setUIState("showDetailModal", true);
                    }}
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
                    onView={(rr) => {
                      setUIState("selectedItem", rr);
                      setUIState("showDetailModal", true);
                    }}
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
          onAdd={() => {
            setUIState("createType", "pjp");
            setUIState("showCreateModal", true);
          }}
        >
          {isLoading ? (
            <LoadingList rows={3} />
          ) : activePJPs.length ? (
            <div className="space-y-3">
              {activePJPs.map((pjp: any, i: number) => (
                <PJPCard
                  key={pjp.id ?? i}
                  pjp={pjp}
                  onView={(p) => {
                    setUIState("selectedItem", p);
                    setUIState("showDetailModal", true);
                  }}
                  onEdit={(p) => {
                    setUIState("selectedItem", p);
                    setUIState("createType", "pjp");
                    setUIState("showCreateModal", true);
                  }}
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
          onAdd={() => setOpenDealer(true)}   // the "+" in the section header
        >
          {isLoading ? (
            <LoadingList rows={3} />
          ) : (dealers || []).length ? (
            <div className="space-y-3">
              {(dealers || []).slice(0, 5).map((dealer: any, i: number) => (
                <DealerCard
                  key={dealer.id ?? i}
                  dealer={dealer}
                  onView={(d) => {
                    setUIState("selectedItem", d);
                    setUIState("showDetailModal", true);
                  }}
                  onEdit={(d) => {
                    // if you want edit to reuse the same form later, call setOpenDealer(true) and preload state
                    setUIState("selectedItem", d);
                    setUIState("createType", "dealer");
                    setUIState("showCreateModal", true);
                  }}
                  onDelete={(id) => deleteRecord("dealer", id)}
                  onScore={(d) => {
                    setUIState("selectedItem", d);
                    setUIState("createType", "dealer-score");
                    setUIState("showCreateModal", true);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Empty icon={Building2} label="No dealers yet" />
              <Button className="mt-3" onClick={() => setOpenDealer(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Dealer/Sub-Dealer
              </Button>
            </div>
          )}
        </Section>

        {/* One dialog to rule them all */}
        <Dialog modal={false} open={openDealer} onOpenChange={setOpenDealer}>
          <DialogContent className="p-0 sm:max-w-md w-[100vw] sm:w-auto h-[90vh] sm:h-auto overflow-hidden">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle>Add Dealer / Sub-Dealer</DialogTitle>
            </DialogHeader>
            <div className="h-full sm:h-auto overflow-y-auto px-4 pb-4">
              <AddDealerForm
                userId={user?.id}
                onSubmitted={async (payload) => {
                  // TODO: POST to your API: /api/dealers (insert into Neon via Drizzle)
                  // await createRecord("dealer", payload);
                  // await fetchAllData(); // refresh lists
                  setOpenDealer(false);
                }}
                onCancel={() => setOpenDealer(false)}
              />
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
