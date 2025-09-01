import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Calendar as CalendarIcon, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type UserLite = {
    id: number;
    firstName?: string;
    lastName?: string;
    role?: string;
};

type Props = {
    user?: UserLite | null;
    dealers?: { id: string; name: string; address?: string }[];  // 👈 new prop
    onSubmitted?: (payload: any) => void;
    onCancel?: () => void;
};

const STATUS = ["planned", "active", "completed", "cancelled"] as const;

export default function PJPForm({ user, dealers, onSubmitted, onCancel }: Props) {
    const [planDate, setPlanDate] = React.useState<Date>(new Date());
    const [areaToBeVisited, setAreaToBeVisited] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [status, setStatus] = React.useState<(typeof STATUS)[number]>("planned");
    const [submitting, setSubmitting] = React.useState(false);

    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

    const validate = () => {
        if (!user?.id) return "Missing user context.";
        if (!planDate) return "Pick a plan date.";
        if (!areaToBeVisited.trim()) return "Area to be visited is required.";
        if (!status) return "Status is required.";
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const err = validate();
        if (err) return alert(err);

        const payload = {
            userId: user!.id,
            createdById: user!.id,
            planDate: planDate.toISOString().slice(0, 10),
            areaToBeVisited: areaToBeVisited.trim(),
            description: description.trim() || null,
            status,
        };

        try {
            setSubmitting(true);
            onSubmitted?.(payload);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Create PJP (Self)</h3>
                <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Who */}
            <div className="grid gap-1">
                <Label>Salesperson</Label>
                <div className="text-sm px-3 py-2 rounded-md bg-muted/40 border">
                    {fullName || "You"}{user?.role ? ` • ${user.role}` : ""}
                </div>
            </div>

            {/* Date */}
            <div className="grid gap-2">
                <Label>Plan Date</Label>
                <Popover modal={false}>
                    <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {planDate ? format(planDate, "PPP") : "Pick a date"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={planDate}
                            onSelect={(d) => d && setPlanDate(d)}
                        // usually you plan for today or future
                        // disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                        />
                    </PopoverContent>
                </Popover>
            </div>

            {/* Area */}
            <div className="grid gap-2">
                <Label>Destination Dealer</Label>
                <Select value={areaToBeVisited} onValueChange={setAreaToBeVisited}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select dealer" />
                    </SelectTrigger>
                    <SelectContent>
                        {(dealers || []).map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                                {d.name} {d.address ? `– ${d.address}` : ""}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Description (optional) */}
            <div className="grid gap-2">
                <Label>Description (optional)</Label>
                <Textarea
                    rows={3}
                    placeholder="Short note/objective for this plan"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>

            {/* Status */}
            <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                        {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                    {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>) : "Save PJP"}
                </Button>
            </div>
        </form>
    );
}
