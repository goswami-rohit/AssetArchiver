import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, ArrowLeft, CalendarIcon, ChevronsUpDown, Check } from 'lucide-react';
import { useLocation } from "wouter";

// --- UI Components ---
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Toaster } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// --- Custom Hooks & Constants ---
import { useAppStore, BASE_URL, UNITS } from '../../components/ReusableUI';

// --- Helper for combining Tailwind classes ---
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- Zod Schema ---
const SalesOrderSchema = z.object({
  dealerId: z.string().min(1, "A dealer must be selected"),
  quantity: z.coerce.number().positive({ message: "Quantity must be a positive number" }),
  unit: z.string().min(1, "A unit is required"),
  orderTotal: z.coerce.number().positive({ message: "Order total must be a positive number" }),
  advancePayment: z.coerce.number().min(0, "Advance payment cannot be negative"),
  pendingPayment: z.coerce.number().min(0),
  estimatedDelivery: z.date({ required_error: "An estimated delivery date is required" }),
  remarks: z.string().optional().nullable(),
});

type SalesOrderFormValues = z.infer<typeof SalesOrderSchema>;

interface Dealer {
  id: string;
  name: string;
  address: string;
  phoneNo: string;
  region: string;
  area: string;
  type: string;
}

// --- Component ---
export default function SalesOrderForm() {
  const [, navigate] = useLocation();
  const { user } = useAppStore();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDealerDialogOpen, setIsDealerDialogOpen] = useState(false);

  const { control, handleSubmit, setValue, watch, formState: { errors, isSubmitting, isValid } } = useForm<SalesOrderFormValues>({
    resolver: zodResolver(SalesOrderSchema),
    mode: 'onChange',
    // FIX: Set a default value that passes validation to make the button clickable
    defaultValues: {
      dealerId: '',
      quantity: 1, // Set to 1 to pass positive validation
      unit: '',
      orderTotal: 1, // Set to 1 to pass positive validation
      advancePayment: 0,
      pendingPayment: 0,
      estimatedDelivery: new Date(),
      remarks: '',
    },
  });

  const [orderTotal, advancePayment, dealerId] = watch(['orderTotal', 'advancePayment', 'dealerId']);
  const selectedDealer = dealers.find(d => d.id === dealerId) || null;

  useEffect(() => {
    const fetchDealers = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/dealers`);
        if (!response.ok) throw new Error('Failed to fetch dealers');
        const result = await response.json();
        if (result.success) setDealers(result.data);
        else toast.error("Error", { description: "Could not load dealers." });
      } catch (error: any) {
        toast.error("Network Error", { description: error.message });
      } finally {
        setIsLoading(false);
      }
    };
    fetchDealers();
  }, []);

  useEffect(() => {
    const total = Number(orderTotal || 0);
    const advance = Number(advancePayment || 0);
    setValue('pendingPayment', Math.max(0, total - advance));
  }, [orderTotal, advancePayment, setValue]);

  const submit = async (values: SalesOrderFormValues) => {
    try {
      const payload = {
        salesmanId: user?.id,
        ...values,
        quantity: String(values.quantity),
        orderTotal: String(values.orderTotal),
        advancePayment: String(values.advancePayment),
        pendingPayment: String(values.pendingPayment),
        estimatedDelivery: format(values.estimatedDelivery, 'yyyy-MM-dd'),
      };

      const response = await fetch(`${BASE_URL}/api/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to submit sales order.' }));
        throw new Error(errorData.error || errorData.message);
      }

      toast.success('Order Submitted', { description: 'The sales order has been sent successfully.' });
      setTimeout(() => navigate('/'), 1500);

    } catch (error: any) {
      toast.error('Submission Failed', { description: error.message });
    }
  };

  return (
    // FIX: Removed min-h-screen and bg-gray-50 from the main container
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-lg font-bold ml-2">Create Sales Order</h1>
        </div>
      </header>
      
      {/* FIX: Removed overflow-auto from the main tag */}
      <main className="flex-1 p-6">
        <form onSubmit={handleSubmit(submit)} className="max-w-4xl mx-auto space-y-8 pb-28">
          
          {/* Salesman Details */}
          <div>
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">Salesman Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Salesman Name</Label>
                <Input value={`${user?.firstName || ''} ${user?.lastName || ''}`} disabled />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Input value={user?.role || ''} disabled />
              </div>
            </div>
          </div>

          {/* Dealer Details */}
          <div>
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">Dealer Details</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Select Dealer *</Label>
                 <Dialog open={isDealerDialogOpen} onOpenChange={setIsDealerDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-between h-12 font-normal text-left">
                        {selectedDealer ? `${selectedDealer.name} - ${selectedDealer.address}` : "Select a dealer..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="p-0">
                      <Command>
                        <CommandInput placeholder="Search for a dealer..." />
                        <CommandList>
                          {isLoading && <div className="p-4 text-center text-sm">Loading dealers...</div>}
                          <CommandEmpty>No dealer found.</CommandEmpty>
                          <CommandGroup>
                            {dealers.map((dealer) => (
                              <CommandItem key={dealer.id} value={dealer.name} onSelect={() => {
                                setValue("dealerId", dealer.id, { shouldValidate: true });
                                setIsDealerDialogOpen(false);
                              }}>
                                <Check className={cn("mr-2 h-4 w-4", dealerId === dealer.id ? "opacity-100" : "opacity-0")} />
                                <div>
                                    <p>{dealer.name}</p>
                                    <p className="text-xs text-muted-foreground">{dealer.address}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </DialogContent>
                  </Dialog>
                  {errors.dealerId && <p className="text-sm text-red-500 mt-1">{errors.dealerId.message}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input placeholder="Dealer Type" value={selectedDealer?.type || ''} disabled />
                  <Input placeholder="Dealer Phone" value={selectedDealer?.phoneNo || ''} disabled />
              </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input placeholder="Area" value={selectedDealer?.area || ''} disabled />
                  <Input placeholder="Region" value={selectedDealer?.region || ''} disabled />
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div>
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">Order Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Controller name="quantity" control={control} render={({ field }) => (
                  <div className="space-y-1">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input {...field} id="quantity" type="number" placeholder="0" onChange={e => field.onChange(e.target.valueAsNumber)} />
                    {errors.quantity && <p className="text-sm text-red-500 mt-1">{errors.quantity.message}</p>}
                  </div>
                )} />
                <Controller name="unit" control={control} render={({ field }) => (
                  <div className="space-y-1">
                    <Label>Unit *</Label>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Select Unit..." /></SelectTrigger>
                      <SelectContent>{UNITS.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.unit && <p className="text-sm text-red-500 mt-1">{errors.unit.message}</p>}
                  </div>
                )} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Controller name="orderTotal" control={control} render={({ field }) => (
                    <div className="space-y-1">
                        <Label htmlFor="orderTotal">Order Total (₹) *</Label>
                        <Input {...field} id="orderTotal" type="number" placeholder="0.00" onChange={e => field.onChange(e.target.valueAsNumber)} />
                        {errors.orderTotal && <p className="text-sm text-red-500 mt-1">{errors.orderTotal.message}</p>}
                    </div>
                )} />
                <Controller name="advancePayment" control={control} render={({ field }) => (
                    <div className="space-y-1">
                        <Label htmlFor="advancePayment">Advance (₹) *</Label>
                        <Input {...field} id="advancePayment" type="number" placeholder="0.00" onChange={e => field.onChange(e.target.valueAsNumber)} />
                        {errors.advancePayment && <p className="text-sm text-red-500 mt-1">{errors.advancePayment.message}</p>}
                    </div>
                )} />
                <Controller name="pendingPayment" control={control} render={({ field }) => (
                    <div className="space-y-1">
                        <Label htmlFor="pendingPayment">Pending (₹)</Label>
                        <Input {...field} id="pendingPayment" type="number" disabled />
                    </div>
                )} />
              </div>
              <Controller name="estimatedDelivery" control={control} render={({ field }) => (
                <div className="space-y-1">
                    <Label>Estimated Delivery *</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full sm:w-1/2 justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                    </Popover>
                    {errors.estimatedDelivery && <p className="text-sm text-red-500 mt-1">{errors.estimatedDelivery.message}</p>}
                </div>
              )} />
              <Controller name="remarks" control={control} render={({ field }) => (
                  <div className="space-y-1">
                      <Label htmlFor="remarks">Remarks (Optional)</Label>
                      <Textarea {...field} value={field.value || ''} id="remarks" placeholder="Add any special instructions or notes..." />
                  </div>
              )} />
            </div>
          </div>
          
          <div className="pt-4">
            <Button type="submit" className="w-full h-12" disabled={!isValid || isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Order...</> : "Submit & Send Order"}
            </Button>
          </div>
        </form>
      </main>
      <Toaster />
    </div>
  );
}