import React, { useState, useEffect } from 'react';
import type { SubmitHandler, Resolver } from 'react-hook-form';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useLocation } from "wouter";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";

// Lucide React Icons
import {
  ChevronsUpDown,
  Search,
  Crosshair,
  Calendar,
  ArrowLeft
} from "lucide-react";

// Reusable Constants & State Management
import { useAppStore, DEALER_TYPES, BRANDS, FEEDBACKS, BASE_URL } from '../../components/ReusableUI';

// Zod Schema to match the database table
const DealerSchema = z.object({
  userId: z.number().optional(),
  type: z.string().min(1, "Dealer type is required"),
  isSubDealer: z.boolean(),
  parentDealerId: z.string().optional().nullable(),
  name: z.string().min(3, "Name must be at least 3 characters"),
  region: z.string().min(1, "Region is required"),
  area: z.string().min(2, "Area is required"),
  phoneNo: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit phone number"),
  address: z.string().min(10, "Address must be at least 10 characters"),
  pinCode: z.string().optional().nullable().refine(val => !val || /^\d{6}$/.test(val), {
    message: "Must be a 6-digit PIN code",
  }),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  dateOfBirth: z.string().optional().nullable().refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: "Date must be in YYYY-MM-DD format",
  }),
  anniversaryDate: z.string().optional().nullable().refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: "Date must be in YYYY-MM-DD format",
  }),
  totalPotential: z.coerce.number().min(0, "Must be a non-negative number"),
  bestPotential: z.coerce.number().min(0, "Must be a non-negative number"),
  brandSelling: z.array(z.string()).min(1, "Select at least one brand"),
  feedbacks: z.string().min(1, "Feedback is required"),
  remarks: z.string().optional(),
}).refine(data => !data.isSubDealer || (data.isSubDealer && data.parentDealerId), {
  message: "Parent dealer is required for sub-dealers",
  path: ["parentDealerId"],
});

type DealerFormValues = z.infer<typeof DealerSchema>;

export default function AddDealerForm() {
  const [, navigate] = useLocation();
  const { user } = useAppStore();

  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [brandsModalOpen, setBrandsModalOpen] = useState(false);
  const [dealersData, setDealersData] = useState<any[]>([]);
  const [isDealersLoading, setIsDealersLoading] = useState(true);
  const [dealerModalOpen, setDealerModalOpen] = useState(false);
  const [dealerSearchQuery, setDealerSearchQuery] = useState('');

  const { control, handleSubmit, setValue, watch, formState: { errors, isSubmitting, isValid } } = useForm<DealerFormValues>({
    resolver: zodResolver(DealerSchema) as unknown as Resolver<DealerFormValues, any>,
    mode: 'onChange',
    // FIX: Reverted to empty strings for a better user experience
    defaultValues: {
      userId: undefined,
      type: '',
      isSubDealer: false,
      parentDealerId: null,
      name: '',
      region: '',
      area: '',
      phoneNo: '',
      address: '',
      pinCode: '',
      latitude: null,
      longitude: null,
      dateOfBirth: '',
      anniversaryDate: '',
      totalPotential: 0,
      bestPotential: 0,
      brandSelling: [],
      feedbacks: '',
      remarks: '',
    },
  });

  const isSubDealer = watch('isSubDealer');
  const brandSelling = watch('brandSelling');
  const parentDealerId = watch('parentDealerId');

  const selectedParentDealerName = dealersData.find(d => d.id === parentDealerId)?.name || '';

  const filteredDealers = dealersData.filter(d =>
    d.name.toLowerCase().includes(dealerSearchQuery.toLowerCase())
  );

  useEffect(() => {
    const fetchDealers = async () => {
      try {
        setIsDealersLoading(true);
        const response = await fetch(`${BASE_URL}/api/dealers`);
        const result = await response.json();
        if (response.ok && result.success) {
          setDealersData(result.data);
        } else {
          toast.error("Failed to load dealers.", {
            description: "An error occurred while fetching dealer data."
          });
        }
      } catch (err) {
        toast.error("Failed to fetch dealers.", {
          description: "Please check your network connection."
        });
      } finally {
        setIsDealersLoading(false);
      }
    };
    fetchDealers();
  }, [user?.id]);

  const fetchLocation = () => {
    setIsLoadingLocation(true);

    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not supported", { description: "Your browser does not support location services." });
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setValue("latitude", latitude, { shouldValidate: true });
        setValue("longitude", longitude, { shouldValidate: true });
        toast.success("Location Captured", { description: `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}` });
        setIsLoadingLocation(false);
      },
      (error) => {
        toast.error("Location Error", { description: error.message || "Unable to fetch location." });
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };


  const submit: SubmitHandler<DealerFormValues> = async (values) => {
    try {
      // Build numbers/null in a way server expects
      const latNum = values.latitude !== null && values.latitude !== undefined ? Number(values.latitude) : null;
      const lngNum = values.longitude !== null && values.longitude !== undefined ? Number(values.longitude) : null;

      // If your flow requires geofence creation on insert, enforce lat/lng presence client-side
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        toast.error("Please capture dealer location (Use My Current Location) before saving.");
        return;
      }

      // Build payload to match server schema (numbers for numeric columns)
      const payload: any = {
        // only include userId if available (server allows optional)
        ...(user?.id ? { userId: Number(user.id) } : {}),
        type: values.type,
        parentDealerId: values.isSubDealer ? values.parentDealerId || null : null,
        name: values.name,
        region: values.region,
        area: values.area,
        phoneNo: values.phoneNo,
        address: values.address,
        pinCode: values.pinCode || null,
        // keep as numbers so server Number(...) works and zod/DB receive numeric input
        latitude: latNum,
        longitude: lngNum,
        dateOfBirth: values.dateOfBirth || null,
        anniversaryDate: values.anniversaryDate || null,
        totalPotential: Number(values.totalPotential ?? 0),
        bestPotential: Number(values.bestPotential ?? 0),
        brandSelling: values.brandSelling,
        feedbacks: values.feedbacks,
        remarks: values.remarks || null,
        // optional: allow client to specify custom geofence radius in meters
        radius: 25
      };

      const response = await fetch(`${BASE_URL}/api/dealers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || (result && result.success === false)) {
        // Server might return helpful Zod details in result.details
        const errMsg = result?.error || (result?.details ? JSON.stringify(result.details) : 'Failed to create dealer');
        throw new Error(errMsg);
      }

      toast.success("Dealer Created", {
        description: "The new dealer has been saved and geofence upserted."
      });
      navigate('/');
    } catch (error: any) {
      toast.error("Submission Failed", {
        description: error?.message || "An unexpected error occurred."
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold ml-2">Add New Dealer</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-1">Dealer Information</h2>
          <p className="text-sm text-center text-gray-500 mb-6">Fill in the details for the new dealer.</p>

          <form onSubmit={handleSubmit(submit)} className="space-y-6 pb-28">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <Label htmlFor="is-sub-dealer">Is this a Sub-Dealer?</Label>
              <Controller
                control={control}
                name="isSubDealer"
                render={({ field: { onChange, value } }) => (
                  <Switch
                    checked={value}
                    onCheckedChange={onChange}
                    id="is-sub-dealer"
                  />
                )}
              />
            </div>

            {isSubDealer && (
              <div className="space-y-1">
                <Label>Parent Dealer *</Label>
                <Dialog open={dealerModalOpen} onOpenChange={setDealerModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-12">
                      {selectedParentDealerName || "Select Parent Dealer"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Select Parent Dealer</DialogTitle>
                    </DialogHeader>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search dealers..."
                        className="pl-8 mb-4"
                        value={dealerSearchQuery}
                        onChange={(e) => setDealerSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="h-[200px] overflow-y-auto">
                      {isDealersLoading ? (
                        <div className="flex justify-center items-center h-full">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {filteredDealers.length > 0 ? (
                            filteredDealers.map(d => (
                              <Button
                                key={d.id}
                                variant="ghost"
                                className="w-full justify-start"
                                onClick={() => {
                                  setValue('parentDealerId', d.id, { shouldValidate: true });
                                  setDealerModalOpen(false);
                                  setDealerSearchQuery('');
                                }}
                              >
                                {d.name}
                              </Button>
                            ))
                          ) : (
                            <p className="text-center text-sm text-gray-500">No dealers found.</p>
                          )}
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button onClick={() => setDealerModalOpen(false)}>Done</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                {errors.parentDealerId && <p className="text-sm text-red-500 mt-1">{errors.parentDealerId.message}</p>}
              </div>
            )}

            <div className="space-y-1">
              <Label>Dealer Type *</Label>
              <Controller
                control={control}
                name="type"
                render={({ field: { onChange, value } }) => (
                  <Select onValueChange={onChange} value={value}>
                    <SelectTrigger className="w-full h-12">
                      <SelectValue placeholder="Select Dealer Type *" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEALER_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && <p className="text-sm text-red-500 mt-1">{errors.type.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">Dealer Name *</Label>
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <Input {...field} id="name" placeholder="Enter dealer's full name" className="h-12" />
                )}
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="region">Region *</Label>
                <Controller
                  control={control}
                  name="region"
                  render={({ field }) => (
                    <Input {...field} id="region" placeholder="Enter region" className="h-12" />
                  )}
                />
                {errors.region && <p className="text-sm text-red-500 mt-1">{errors.region.message}</p>}
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="area">Area *</Label>
                <Controller
                  control={control}
                  name="area"
                  render={({ field }) => (
                    <Input {...field} id="area" placeholder="Enter area name" className="h-12" />
                  )}
                />
                {errors.area && <p className="text-sm text-red-500 mt-1">{errors.area.message}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="address">Address *</Label>
              <Controller
                control={control}
                name="address"
                render={({ field }) => (
                  <textarea {...field} id="address" placeholder="Enter full address" rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                )}
              />
              {errors.address && <p className="text-sm text-red-500 mt-1">{errors.address.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="phoneNo">Phone No *</Label>
              <Controller
                control={control}
                name="phoneNo"
                render={({ field }) => (
                  <Input {...field} id="phoneNo" placeholder="Enter 10-digit phone number" type="tel" className="h-12" />
                )}
              />
              {errors.phoneNo && <p className="text-sm text-red-500 mt-1">{errors.phoneNo.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="pinCode">PIN Code</Label>
              <Controller
                control={control}
                name="pinCode"
                render={({ field: { value, ...field } }) => (
                  <Input
                    {...field}
                    id="pinCode"
                    placeholder="Enter 6-digit PIN code"
                    type="number"
                    className="h-12"
                    value={value !== null && value !== undefined ? String(value) : ''}
                  />
                )}
              />
              {errors.pinCode && <p className="text-sm text-red-500 mt-1">{errors.pinCode.message}</p>}
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="latitude">Latitude</Label>
                <Controller
                  control={control}
                  name="latitude"
                  render={({ field: { value, ...field } }) => (
                    <Input
                      {...field}
                      id="latitude"
                      placeholder="Latitude"
                      value={value !== null && value !== undefined ? String(value) : ''}
                      disabled
                    />
                  )}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="longitude">Longitude</Label>
                <Controller
                  control={control}
                  name="longitude"
                  render={({ field: { value, ...field } }) => (
                    <Input
                      {...field}
                      id="longitude"
                      placeholder="Longitude"
                      value={value !== null && value !== undefined ? String(value) : ''}
                      disabled
                    />
                  )}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={fetchLocation}
              disabled={isLoadingLocation}
              className="w-full h-12"
            >
              {isLoadingLocation ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                  Fetching Location...
                </>
              ) : (
                <>
                  <Crosshair className="h-4 w-4 mr-2" />
                  Use My Current Location
                </>
              )}
            </Button>

            <div className="my-8 h-px bg-white/10" />

            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Controller
                  control={control}
                  name="dateOfBirth"
                  render={({ field: { value, ...field } }) => (
                    <div className="relative">
                      <Input
                        {...field}
                        id="dateOfBirth"
                        placeholder="YYYY-MM-DD"
                        className="h-12"
                        value={value || ''}
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                />
                {errors.dateOfBirth && <p className="text-sm text-red-500 mt-1">{errors.dateOfBirth.message}</p>}
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="anniversaryDate">Anniversary Date</Label>
                <Controller
                  control={control}
                  name="anniversaryDate"
                  render={({ field: { value, ...field } }) => (
                    <div className="relative">
                      <Input
                        {...field}
                        id="anniversaryDate"
                        placeholder="YYYY-MM-DD"
                        className="h-12"
                        value={value || ''}
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                />
                {errors.anniversaryDate && <p className="text-sm text-red-500 mt-1">{errors.anniversaryDate.message}</p>}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="totalPotential">Total Potential *</Label>
                <Controller
                  control={control}
                  name="totalPotential"
                  render={({ field }) => (
                    <Input {...field} id="totalPotential" placeholder="Enter total potential" type="number" className="h-12" />
                  )}
                />
                {errors.totalPotential && <p className="text-sm text-red-500 mt-1">{errors.totalPotential.message}</p>}
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="bestPotential">Best Potential *</Label>
                <Controller
                  control={control}
                  name="bestPotential"
                  render={({ field }) => (
                    <Input {...field} id="bestPotential" placeholder="Enter best potential" type="number" className="h-12" />
                  )}
                />
                {errors.bestPotential && <p className="text-sm text-red-500 mt-1">{errors.bestPotential.message}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Brands Selling *</Label>
              <Dialog open={brandsModalOpen} onOpenChange={setBrandsModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-12">
                    {brandSelling?.length > 0 ? brandSelling.join(', ') : 'Select brands...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Select Brands</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-2 overflow-y-auto max-h-[300px]">
                    {BRANDS.map(brand => (
                      <div key={brand} className="flex items-center space-x-2">
                        <Checkbox
                          id={brand}
                          checked={brandSelling.includes(brand)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setValue('brandSelling', [...brandSelling, brand], { shouldValidate: true });
                            } else {
                              setValue('brandSelling', brandSelling.filter(b => b !== brand), { shouldValidate: true });
                            }
                          }}
                        />
                        <Label htmlFor={brand} className="cursor-pointer font-normal">{brand}</Label>
                      </div>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setBrandsModalOpen(false)}>Done</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {errors.brandSelling && <p className="text-sm text-red-500 mt-1">{errors.brandSelling.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Feedback *</Label>
              <Controller
                control={control}
                name="feedbacks"
                render={({ field: { onChange, value } }) => (
                  <Select onValueChange={onChange} value={value}>
                    <SelectTrigger className="w-full h-12">
                      <SelectValue placeholder="Select Feedback *" />
                    </SelectTrigger>
                    <SelectContent>
                      {FEEDBACKS.map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.feedbacks && <p className="text-sm text-red-500 mt-1">{errors.feedbacks.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="remarks">Remarks</Label>
              <Controller
                control={control}
                name="remarks"
                render={({ field }) => (
                  <textarea {...field} id="remarks" placeholder="Add remarks or notes..." rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                )}
              />
              {errors.remarks && <p className="text-sm text-red-500 mt-1">{errors.remarks.message}</p>}
            </div>

            <Button
              type="submit"
              className="w-full h-12"
              disabled={isSubmitting || !isValid}
            >
              {isSubmitting ? "Saving..." : "Save Dealer"}
            </Button>
          </form>
        </div>
      </main>
      <Toaster />
    </div>
  );
}