// src/pages/HomePage.tsx
import React, { useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import {
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
  Package,
  Edit,
  Trash2,
  Eye,
  MapIcon,
  PhoneCall,
  Star,
} from "lucide-react";

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
    attendanceStatus,
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

  return (
    <div className="min-h-full flex flex-col">
      <StatusBar />

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
                  <>
                    <LogOut className="h-4 w-4 mr-1" /> Out
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-1" /> In
                  </>
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

      {/* Main Content (AppShell provides the scroll; just add bottom padding) */}
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
              onClick={() => {
                setUIState("createType", "dvr");
                setUIState("showCreateModal", true);
              }}
            >
              <FileText className="h-5 w-5" />
              <span className="text-xs">Create DVR</span>
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col gap-2 bg-card/50 border-0 shadow-sm"
              onClick={() => {
                setUIState("createType", "sales-report");
                setUIState("showCreateModal", true);
              }}
            >
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs">Sales Report</span>
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col gap-2 bg-card/50 border-0 shadow-sm"
              onClick={() => {
                setUIState("createType", "collection-report");
                setUIState("showCreateModal", true);
              }}
            >
              <DollarSign className="h-5 w-5" />
              <span className="text-xs">Collection</span>
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col gap-2 bg-card/50 border-0 shadow-sm"
              onClick={() => {
                setUIState("createType", "ddp");
                setUIState("showCreateModal", true);
              }}
            >
              <Package className="h-5 w-5" />
              <span className="text-xs">DDP</span>
            </Button>
          </div>
        </div>

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
          onAdd={() => {
            setUIState("createType", "dealer");
            setUIState("showCreateModal", true);
          }}
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
              <Button
                className="mt-3"
                onClick={() => {
                  setUIState("createType", "dealer");
                  setUIState("showCreateModal", true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Add First Dealer
              </Button>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
