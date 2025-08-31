// src/components/ReusableUI.tsx - COMPLETELY REDESIGNED
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { create } from "zustand";

// Import Lucide React icons
import { 
  MapPin, 
  Navigation, 
  Search, 
  Clock, 
  Route, 
  Target, 
  Car, 
  Edit3,
  Timer,
  Navigation2,
  Map as MapIcon,
  ArrowLeft,
  Plus,
  Minus,
  Locate
} from 'lucide-react';

// Your existing interfaces remain the same...
export interface Company { 
    companyName?: string 
}

export interface UserShape {
  id: number
  firstName?: string
  lastName?: string
  email?: string
  role?: string
  company?: Company
  companyId?: number | null
}

export interface AppState {
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
  tvrReports: any[]
  salesReports: any[]
  collectionReports: any[]
  clientReports: any[]
  competitionReports: any[]
  dealerBrandMappings: any[]
  ddpReports: any[]
  leaveApplications: any[]
  brands: any[]
  ratings: any[]
  attendanceHistory: any[]
  userTargets: any[]
  dealerScores: any[]
  dashboardStats: {
    todaysTasks: number;
    activePJPs: number;
    totalDealers: number;
    totalReports: number;
  }

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
  setData: (k: string, data: any) => void
  setUIState: (k: string, v: any) => void
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
  tvrReports: [],
  salesReports: [],
  collectionReports: [],
  clientReports: [],
  competitionReports: [],
  dealerBrandMappings: [],
  ddpReports: [],
  leaveApplications: [],
  brands: [],
  ratings: [],
  attendanceHistory: [],
  userTargets: [],
  dealerScores: [],
  dashboardStats: {
    todaysTasks: 0,
    activePJPs: 0,
    totalDealers: 0,
    totalReports: 0
  },

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
// Existing UI Components (keep these)
// --------------------
export const StatusBar = () => {
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

export const LoadingList = ({ rows = 3 }: { rows?: number }) => (
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

export const StatCard = ({ label, value, Icon, gradient }: { label: string; value: number; Icon: any; gradient: string }) => (
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

export const StatTile = ({ icon: Icon, value, label, tint }: { icon: any; value: number; label: string; tint: string }) => (
  <Card className="bg-card/60 border-0 shadow-sm">
    <CardContent className="p-4 text-center">
      <Icon className={`h-8 w-8 mx-auto mb-2 ${tint}`} />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent>
  </Card>
)

// --------------------
// MODERN JOURNEY TRACKER UI COMPONENTS
// --------------------

export const JourneyStatusBadge = ({ status }: { status: 'idle' | 'active' | 'completed' }) => (
  <Badge 
    variant={status === 'active' ? 'destructive' : status === 'completed' ? 'default' : 'secondary'}
    className="animate-pulse"
  >
    {status === 'active' ? '● Live' : status === 'completed' ? '✓ Done' : 'Ready'}
  </Badge>
);

export const ModernJourneyHeader = ({ 
  status, 
  onBack 
}: {
  status: 'idle' | 'active' | 'completed';
  onBack?: () => void;
}) => (
  <div className="flex items-center justify-between p-4 bg-background/95 backdrop-blur-md border-b border-border/50">
    <div className="flex items-center gap-3">
      {onBack && (
        <Button 
          onClick={onBack} 
          variant="ghost" 
          size="icon"
          className="h-9 w-9 rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Journey Tracker</h1>
        <p className="text-xs text-muted-foreground">Real-time location tracking</p>
      </div>
    </div>
    <JourneyStatusBadge status={status} />
  </div>
);

export const ModernTripPlanningCard = ({ 
  currentLocation, 
  selectedDealer, 
  dealers, 
  isLoadingLocation,
  onGetCurrentLocation, 
  onDealerSelect, 
  onStartTrip 
}: {
  currentLocation?: string;
  selectedDealer?: any;
  dealers: any[];
  isLoadingLocation: boolean;
  onGetCurrentLocation: () => void;
  onDealerSelect: (dealerId: string) => void;
  onStartTrip: () => void;
}) => (
  <Card className="mx-4 mb-4 border-0 shadow-xl bg-background/95 backdrop-blur-md">
    <CardHeader className="pb-3">
      <CardTitle className="text-base font-semibold flex items-center gap-2">
        <Route className="h-4 w-4 text-primary" />
        Plan Your Journey
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Origin Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">FROM</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="font-medium text-sm">
              {currentLocation || 'Getting location...'}
            </p>
          </div>
          <Button
            onClick={onGetCurrentLocation}
            disabled={isLoadingLocation}
            size="icon"
            variant="outline"
            className="h-12 w-12 rounded-lg"
          >
            {isLoadingLocation ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Locate className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Destination Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">TO</span>
        </div>
        <Select onValueChange={onDealerSelect}>
          <SelectTrigger className="h-12 border-border/50 bg-muted/50">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Select dealer destination" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {dealers.map((dealer) => (
              <SelectItem key={dealer.id} value={dealer.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{dealer.name}</span>
                  <span className="text-xs text-muted-foreground">{dealer.address}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Start Button */}
      <Button
        onClick={onStartTrip}
        disabled={!currentLocation || !selectedDealer}
        className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90"
      >
        <Car className="h-5 w-5 mr-2" />
        START JOURNEY
      </Button>
    </CardContent>
  </Card>
);

export const ModernActiveTripCard = ({ 
  dealer, 
  distance, 
  duration, 
  onChangeDestination, 
  onCompleteTrip,
  showDestinationChange,
  dealers,
  onDestinationChange,
  onCancelChange
}: {
  dealer: any;
  distance: number;
  duration: number;
  onChangeDestination: () => void;
  onCompleteTrip: () => void;
  showDestinationChange: boolean;
  dealers: any[];
  onDestinationChange: (dealerId: string) => void;
  onCancelChange: () => void;
}) => (
  <Card className="mx-4 mb-4 border-0 shadow-xl bg-background/95 backdrop-blur-md">
    <CardHeader className="pb-3">
      <CardTitle className="text-base font-semibold flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-blue-600" />
          <span>Journey to {dealer.name}</span>
        </div>
        <Button
          onClick={onChangeDestination}
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <Edit3 className="h-3 w-3" />
        </Button>
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Trip Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <MapIcon className="h-4 w-4 mx-auto mb-1 text-blue-600" />
          <p className="text-lg font-bold">
            {distance > 0 ? `${(distance / 1000).toFixed(1)}km` : '0km'}
          </p>
          <p className="text-xs text-muted-foreground">Distance</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <Timer className="h-4 w-4 mx-auto mb-1 text-green-600" />
          <p className="text-lg font-bold">
            {duration > 0 ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : '0:00'}
          </p>
          <p className="text-xs text-muted-foreground">Duration</p>
        </div>
      </div>

      {/* Change Destination */}
      {showDestinationChange && (
        <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
          <p className="text-sm font-medium mb-3">Change Destination:</p>
          <Select onValueChange={onDestinationChange}>
            <SelectTrigger className="mb-2">
              <SelectValue placeholder="Select new dealer" />
            </SelectTrigger>
            <SelectContent>
              {dealers.filter(d => d.id !== dealer?.id).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-xs text-muted-foreground">{d.address}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={onCancelChange}
            variant="ghost"
            size="sm"
            className="mt-2"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Complete Button */}
      <Button
        onClick={onCompleteTrip}
        className="w-full h-12 text-base font-semibold bg-destructive hover:bg-destructive/90"
      >
        <Target className="h-5 w-5 mr-2" />
        COMPLETE JOURNEY
      </Button>
    </CardContent>
  </Card>
);

export const ModernCompletedTripCard = ({ 
  distance, 
  duration, 
  onStartNew 
}: {
  distance: number;
  duration: number;
  onStartNew: () => void;
}) => (
  <Card className="mx-4 mb-4 border-0 shadow-xl bg-green-50 dark:bg-green-950/50">
    <CardContent className="p-6 text-center">
      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
        <Target className="w-8 h-8 text-green-600" />
      </div>
      <h3 className="text-xl font-bold text-green-800 dark:text-green-400 mb-2">Journey Completed!</h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 rounded-lg bg-white/50 dark:bg-background/50">
          <p className="text-lg font-bold">{(distance / 1000).toFixed(1)}km</p>
          <p className="text-xs text-muted-foreground">Distance</p>
        </div>
        <div className="p-3 rounded-lg bg-white/50 dark:bg-background/50">
          <p className="text-lg font-bold">
            {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
          </p>
          <p className="text-xs text-muted-foreground">Duration</p>
        </div>
      </div>
      <Button onClick={onStartNew} className="w-full">
        Start New Journey
      </Button>
    </CardContent>
  </Card>
);

export const ModernMessageCard = ({ 
  type, 
  message 
}: {
  type: 'success' | 'error';
  message: string;
}) => (
  <div className="mx-4 mb-2">
    <Card className={`border-0 shadow-lg ${
      type === 'success' 
        ? 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800' 
        : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800'
    }`}>
      <CardContent className="p-3">
        <p className={`text-sm font-medium ${
          type === 'success' ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'
        }`}>
          {message}
        </p>
      </CardContent>
    </Card>
  </div>
);

export const ModernMapControls = ({ 
  onZoomIn, 
  onZoomOut, 
  onLocate 
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
}) => (
  <div className="absolute top-4 right-4 space-y-2 z-[1000]">
    <Button 
      onClick={onZoomIn}
      size="icon"
      variant="secondary"
      className="h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-md border-border/50"
    >
      <Plus className="h-4 w-4" />
    </Button>
    <Button 
      onClick={onZoomOut}
      size="icon"
      variant="secondary"
      className="h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-md border-border/50"
    >
      <Minus className="h-4 w-4" />
    </Button>
    <Button 
      onClick={onLocate}
      size="icon"
      variant="secondary"
      className="h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-md border-border/50"
    >
      <Locate className="h-4 w-4" />
    </Button>
  </div>
);

// Reusable constants in forms
export const DEALER_TYPES = [ "Dealer-Best", "Sub Dealer-Best", "Dealer-Non Best", "Sub Dealer-Non Best",] as const;
export const BRANDS = ["Star", "Amrit", "Dalmia", "Topcem", "Black Tiger", "Surya Gold", "Max", "Taj", "Specify in remarks"];
export const UNITS = ["MT", "KG", "Bags"] as const;
export const REGIONS = ["Kamrup M", "Kamrup", "Karbi Anglong", "Dehmaji"];
export const AREAS = ["Guwahati", "Beltola", "Zoo Road", "Tezpur", "Diphu", "Nagaon", "Barpeta"];