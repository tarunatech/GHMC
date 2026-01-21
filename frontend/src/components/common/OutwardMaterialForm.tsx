import { useState, useEffect, useRef } from "react";
import { OutwardMaterial, CreateOutwardMaterialData } from "@/services/outward.service";
import transportersService from "@/services/transporters.service";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
    onCancel: () => void;
    onSubmit: (data: CreateOutwardMaterialData) => void;
    entry?: OutwardMaterial;
    outwardEntries?: any[]; // Using any for now to avoid circular dependency issues or just simplifying
    isLoading?: boolean;
}

export default function OutwardMaterialForm({ onCancel, onSubmit, entry, outwardEntries = [], isLoading }: Props) {
    const { user } = useAuth();
    const [formData, setFormData] = useState<CreateOutwardMaterialData>({
        outwardEntryId: entry?.outwardEntryId ?? undefined,
        date: entry?.date ? new Date(entry.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        cementCompany: entry?.cementCompany ?? undefined,
        manifestNo: entry?.manifestNo ?? undefined,
        vehicleNo: entry?.vehicleNo ?? undefined,
        wasteName: entry?.wasteName ?? undefined,
        quantity: (entry?.quantity !== null && entry?.quantity !== undefined) ? Number(entry.quantity) : undefined,
        month: entry?.month ?? undefined,
        unit: (entry?.unit as "MT" | "Kg" | "KL") ?? undefined,
        transporterName: entry?.transporterName ?? '',
        invoiceNo: entry?.invoiceNo ?? undefined,
        vehicleCapacity: entry?.vehicleCapacity ?? undefined,
        rate: (entry?.rate !== null && entry?.rate !== undefined) ? Number(entry.rate) : undefined,
        amount: (entry?.amount !== null && entry?.amount !== undefined) ? Number(entry.amount) : undefined,
        detCharges: (entry?.detCharges !== null && entry?.detCharges !== undefined) ? Number(entry.detCharges) : undefined,
        gst: (entry?.gst !== null && entry?.gst !== undefined) ? Number(entry.gst) : undefined,
        grossAmount: (entry?.grossAmount !== null && entry?.grossAmount !== undefined) ? Number(entry.grossAmount) : undefined,
        paidOn: entry?.paidOn ? new Date(entry.paidOn).toISOString().slice(0, 10) : undefined,
    });

    // Reset form when entry changes (critical for edit mode)
    useEffect(() => {
        if (entry) {
            setFormData({
                outwardEntryId: entry.outwardEntryId ?? undefined,
                date: entry.date ? new Date(entry.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                cementCompany: entry.cementCompany ?? undefined,
                manifestNo: entry.manifestNo ?? undefined,
                vehicleNo: entry.vehicleNo ?? undefined,
                wasteName: entry.wasteName ?? undefined,
                quantity: (entry.quantity !== null && entry.quantity !== undefined) ? Number(entry.quantity) : undefined,
                month: entry.month ?? undefined,
                unit: (entry.unit as "MT" | "Kg" | "KL") ?? undefined,
                transporterName: entry.transporterName ?? '',
                invoiceNo: entry.invoiceNo ?? undefined,
                vehicleCapacity: entry.vehicleCapacity ?? undefined,
                rate: (entry.rate !== null && entry.rate !== undefined) ? Number(entry.rate) : undefined,
                amount: (entry.amount !== null && entry.amount !== undefined) ? Number(entry.amount) : undefined,
                detCharges: (entry.detCharges !== null && entry.detCharges !== undefined) ? Number(entry.detCharges) : undefined,
                gst: (entry.gst !== null && entry.gst !== undefined) ? Number(entry.gst) : undefined,
                grossAmount: (entry.grossAmount !== null && entry.grossAmount !== undefined) ? Number(entry.grossAmount) : undefined,
                paidOn: entry.paidOn ? new Date(entry.paidOn).toISOString().slice(0, 10) : undefined,
            });
        }
    }, [entry]);

    // Fetch transporters
    const { data: transportersData } = useQuery({
        queryKey: ['transporters'],
        queryFn: () => transportersService.getTransporters({ limit: 100 }),
    });

    const transporters = transportersData?.transporters || [];

    const prevOutwardEntryId = useRef(entry?.outwardEntryId);

    // Auto-populate from selected entry
    useEffect(() => {
        if (formData.outwardEntryId && formData.outwardEntryId !== prevOutwardEntryId.current) {
            const selectedEntry = outwardEntries.find(e => e.id === formData.outwardEntryId);
            if (selectedEntry) {
                setFormData(prev => ({
                    ...prev,
                    date: selectedEntry.date ? new Date(selectedEntry.date).toISOString().slice(0, 10) : prev.date,
                    cementCompany: selectedEntry.cementCompany ?? prev.cementCompany,
                    manifestNo: selectedEntry.manifestNo ?? prev.manifestNo,
                    vehicleNo: selectedEntry.vehicleNo ?? prev.vehicleNo,
                    wasteName: selectedEntry.wasteName ?? prev.wasteName,
                    transporterName: selectedEntry.transporter?.name ?? prev.transporterName,
                    vehicleCapacity: selectedEntry.vehicleCapacity ?? prev.vehicleCapacity,
                    quantity: (selectedEntry.quantity !== null && selectedEntry.quantity !== undefined) ? Number(selectedEntry.quantity) : prev.quantity,
                    month: selectedEntry.month ?? prev.month,
                    // Explicitly clear invoicing data when importing a new entry
                    rate: undefined,
                    amount: undefined,
                    detCharges: undefined,
                    gst: undefined,
                    grossAmount: undefined,
                    invoiceNo: undefined,
                    paidOn: undefined,
                }));
            }
        }
        prevOutwardEntryId.current = formData.outwardEntryId;
    }, [formData.outwardEntryId, outwardEntries]);

    // Handle auto-calculation
    // Handle auto-calculation
    useEffect(() => {
        const rate = Number(formData.rate) || 0;
        // Calculation changed from Quantity to Vehicle Capacity as per user request
        const vehicleCapacity = Number(formData.vehicleCapacity) || 0;
        const detCharges = Number(formData.detCharges) || 0;
        const gst = Number(formData.gst) || 0;

        const calculatedAmount = Number((rate * vehicleCapacity).toFixed(2));

        setFormData(prev => {
            const updates: any = {};

            // Calculate amount based on current inputs
            if (calculatedAmount !== prev.amount) {
                updates.amount = calculatedAmount;
            }

            const currentAmount = updates.amount !== undefined ? updates.amount : (prev.amount || 0);
            const newGross = Number((currentAmount + detCharges + gst).toFixed(2));

            // Calculate gross based on the (potentially new) amount
            if (newGross !== prev.grossAmount) {
                updates.grossAmount = newGross;
            }

            if (Object.keys(updates).length > 0) {
                return { ...prev, ...updates };
            }
            return prev;
        });
    }, [formData.rate, formData.vehicleCapacity, formData.detCharges, formData.gst]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.transporterName) {
            alert('Please select a transporter');
            return;
        }
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Select Outward Entry (Optional)</label>
                <select
                    className="input-field w-full"
                    value={formData.outwardEntryId || ''}
                    onChange={(e) => setFormData({ ...formData, outwardEntryId: e.target.value || undefined })}
                >
                    <option value="">-- Select outward entry to import --</option>
                    {outwardEntries.map((en) => (
                        <option key={en.id} value={en.id}>
                            {en.date ? new Date(en.date).toLocaleDateString() : ''} — {en.manifestNo || en.id} — {en.cementCompany || ''}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Date</label>
                    <input
                        type="date"
                        className="input-field w-full"
                        value={formData.date || ''}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Cement Company</label>
                    <input
                        type="text"
                        className="input-field w-full"
                        value={formData.cementCompany || ''}
                        onChange={(e) => setFormData({ ...formData, cementCompany: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Manifest No.</label>
                    <input
                        type="text"
                        className="input-field w-full"
                        value={formData.manifestNo || ''}
                        onChange={(e) => setFormData({ ...formData, manifestNo: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Month</label>
                    <input
                        type="text"
                        className="input-field w-full"
                        value={formData.month || ''}
                        onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Vehicle No.</label>
                    <input
                        type="text"
                        className="input-field w-full"
                        value={formData.vehicleNo || ''}
                        onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Waste Name</label>
                    <input
                        type="text"
                        className="input-field w-full"
                        value={formData.wasteName || ''}
                        onChange={(e) => setFormData({ ...formData, wasteName: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Quantity</label>
                    <input
                        type="number"
                        step="0.01"
                        className="input-field w-full"
                        value={formData.quantity ?? ''}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Unit</label>
                    <select
                        className="input-field w-full"
                        value={formData.unit || ''}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
                    >
                        <option value="">Select Unit</option>
                        <option value="MT">MT</option>
                        <option value="Kg">Kg</option>
                        <option value="KL">KL</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Transporter Name *</label>
                    <select
                        className="input-field w-full"
                        value={formData.transporterName}
                        onChange={(e) => setFormData({ ...formData, transporterName: e.target.value })}
                        required
                    >
                        <option value="">Select Transporter</option>
                        {transporters.map((t) => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                    </select>
                </div>
                {['admin', 'superadmin'].includes(user?.role || '') && (
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Invoice No.</label>
                        <input
                            type="text"
                            className="input-field w-full"
                            value={formData.invoiceNo || ''}
                            onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value || undefined })}
                        />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Vehicle Capacity</label>
                    <input
                        type="text"
                        className="input-field w-full"
                        value={formData.vehicleCapacity || ''}
                        onChange={(e) => setFormData({ ...formData, vehicleCapacity: e.target.value || undefined })}
                    />
                </div>
            </div>

            {['admin', 'superadmin'].includes(user?.role || '') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Rate</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input-field w-full"
                            value={formData.rate ?? ''}
                            onChange={(e) => setFormData({ ...formData, rate: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Amount</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input-field w-full"
                            value={formData.amount ?? ''}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Detention Charges</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input-field w-full"
                            value={formData.detCharges ?? ''}
                            onChange={(e) => setFormData({ ...formData, detCharges: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        />
                    </div>
                </div>
            )}

            {['admin', 'superadmin'].includes(user?.role || '') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">GST</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input-field w-full"
                            value={formData.gst ?? ''}
                            onChange={(e) => setFormData({ ...formData, gst: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Gross Amount</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input-field w-full"
                            value={formData.grossAmount ?? ''}
                            onChange={(e) => setFormData({ ...formData, grossAmount: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Paid On</label>
                        <input
                            type="date"
                            className="input-field w-full"
                            value={formData.paidOn || ''}
                            onChange={(e) => setFormData({ ...formData, paidOn: e.target.value || undefined })}
                        />
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        entry ? 'Update Material Record' : 'Create Material Record'
                    )}
                </Button>
            </div>
        </form>
    );
}
