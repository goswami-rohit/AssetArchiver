import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ChevronDown, ArrowLeft } from 'lucide-react';
// import { useNavigate } from 'react-router-dom'; // 👈 FIX: Removed this import
import { toast } from 'sonner';

// --- UI Components (Assuming they are in these paths) ---
import { Button } from "@/components/ui/button";
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
import { Toaster } from "@/components/ui/sonner";
import {BASE_URL} from "@/components/ReusableUI";

// --- Helper for combining Tailwind classes ---
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- Zod Schema (Unchanged) ---
const SiteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'A valid 6-digit pincode is required'),
  contactPerson: z.string().min(1, 'Contact person is required'),
  contactPhone: z.string().regex(/^\d{10}$/, 'A valid 10-digit phone number is required'),
  contactEmail: z.string().email('Must be a valid email').optional().or(z.literal('')),
  siteType: z.string().min(1, 'Site type is required'),
  description: z.string().optional(),
});

type SiteFormValues = z.infer<typeof SiteSchema>;

const SITE_TYPES = [
  'Industrial', 'Commercial', 'Residential', 'Construction', 'Manufacturing',
  'Warehouse', 'Office Complex', 'Retail', 'Other',
];

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
];

// --- Main App Component ---
export default function AddSiteForm() {
  // const navigate = useNavigate(); // 👈 FIX: Removed this line

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SiteFormValues>({
    resolver: zodResolver(SiteSchema),
    mode: 'onChange',
    defaultValues: {
      name: '', address: '', city: '', state: '', pincode: '',
      contactPerson: '', contactPhone: '', contactEmail: '',
      siteType: '', description: '',
    },
  });

  const submit = async (values: SiteFormValues) => {
    try {
      // API call to create site
      const response = await fetch(`${BASE_URL}/api/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to add site.' }));
        throw new Error(errorData.message || 'An unexpected error occurred.');
      }
      
      toast.success('Site Added', {
        description: 'The new site has been added successfully.',
      });
      
      // Navigate back after a short delay
      setTimeout(() => window.history.back(), 1500); // 👈 FIX: Changed to window.history.back()
      
    } catch (error: any) {
      toast.error('Submission Failed', {
        description: error.message || 'Please try again.',
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}> {/* 👈 FIX: Changed to window.history.back() */}
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold ml-2">Add New Site</h1>
        </div>
      </header>
      
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-1">Site Details</h2>
          <p className="text-sm text-center text-gray-500 mb-6">Enter the information for the new site.</p>
          
          <form onSubmit={handleSubmit(submit)} className="space-y-6">
            <div className="space-y-1">
              <Label htmlFor="name">Site Name *</Label>
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <Input {...field} id="name" placeholder="Enter site name" />
                )}
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="address">Address *</Label>
              <Controller
                control={control}
                name="address"
                render={({ field }) => (
                  <Textarea {...field} id="address" placeholder="Enter site address" rows={3} />
                )}
              />
              {errors.address && <p className="text-sm text-red-500 mt-1">{errors.address.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="city">City *</Label>
                <Controller
                  control={control}
                  name="city"
                  render={({ field }) => (
                    <Input {...field} id="city" placeholder="Enter city" />
                  )}
                />
                {errors.city && <p className="text-sm text-red-500 mt-1">{errors.city.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>State *</Label>
                <Controller
                  control={control}
                  name="state"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select State" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.state && <p className="text-sm text-red-500 mt-1">{errors.state.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-1">
                <Label htmlFor="pincode">Pincode *</Label>
                <Controller
                  control={control}
                  name="pincode"
                  render={({ field }) => (
                    <Input {...field} id="pincode" placeholder="Enter pincode" type="text" maxLength={6} />
                  )}
                />
                {errors.pincode && <p className="text-sm text-red-500 mt-1">{errors.pincode.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Site Type *</Label>
                <Controller
                  control={control}
                  name="siteType"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Site Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {SITE_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.siteType && <p className="text-sm text-red-500 mt-1">{errors.siteType.message}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="contactPerson">Contact Person *</Label>
              <Controller
                control={control}
                name="contactPerson"
                render={({ field }) => (
                  <Input {...field} id="contactPerson" placeholder="Enter contact person's name" />
                )}
              />
              {errors.contactPerson && <p className="text-sm text-red-500 mt-1">{errors.contactPerson.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="contactPhone">Phone Number *</Label>
                <Controller
                  control={control}
                  name="contactPhone"
                  render={({ field }) => (
                    <Input {...field} id="contactPhone" placeholder="Enter phone number" type="tel" maxLength={10} />
                  )}
                />
                {errors.contactPhone && <p className="text-sm text-red-500 mt-1">{errors.contactPhone.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="contactEmail">Email (Optional)</Label>
                <Controller
                  control={control}
                  name="contactEmail"
                  render={({ field }) => (
                    <Input {...field} value={field.value || ''} id="contactEmail" placeholder="Enter email address" type="email" />
                  )}
                />
                {errors.contactEmail && <p className="text-sm text-red-500 mt-1">{errors.contactEmail.message}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">Description (Optional)</Label>
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <Textarea {...field} value={field.value || ''} id="description" placeholder="Add a description for the site" rows={3} />
                )}
              />
            </div>
            
            <Button
              type="submit"
              className="w-full h-12"
              disabled={isSubmitting || !isValid}
            >
              {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Site...
                  </>
                ) : (
                  "Add Site"
                )}
            </Button>
          </form>
        </div>
      </main>
      <Toaster />
    </div>
  );
}