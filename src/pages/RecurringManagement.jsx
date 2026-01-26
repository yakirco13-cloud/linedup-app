import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Search, Repeat, Trash2, Edit, Calendar, Clock, User, Loader2, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeatureGate } from "@/components/FeatureGate";

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function RecurringManagement() {
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingRule, setEditingRule] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteFutureBookings, setDeleteFutureBookings] = useState(true);

  // Fetch business
  const { data: business } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0];
    },
    enabled: !!user?.business_id,
  });

  // Fetch recurring appointments
  const { data: recurringRules = [], isLoading } = useQuery({
    queryKey: ['recurring-appointments', business?.id],
    queryFn: async () => {
      const rules = await base44.entities.RecurringAppointment.filter({ 
        business_id: business.id 
      });
      return rules;
    },
    enabled: !!business?.id,
  });

  // Fetch services for edit modal
  const { data: services = [] } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: () => base44.entities.Service.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  // Fetch staff for edit modal
  const { data: staff = [] } = useQuery({
    queryKey: ['staff', business?.id],
    queryFn: () => base44.entities.Staff.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  // Update recurring rule mutation
  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      return await base44.entities.RecurringAppointment.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-appointments'] });
      setEditingRule(null);
    },
  });

  // Delete recurring rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async ({ ruleId, deleteFuture }) => {
      // If deleteFuture is true, also delete all future bookings
      if (deleteFuture) {
        const today = new Date().toISOString().split('T')[0];
        const bookings = await base44.entities.Booking.filter({
          business_id: business.id
        });
        
        // Find bookings from this recurring rule that are in the future
        // Since we don't have recurring_appointment_id, match by client + service + day + time
        const rule = recurringRules.find(r => r.id === ruleId);
        if (rule) {
          const futureBookings = bookings.filter(b => {
            if (b.date < today) return false;
            if (b.client_phone !== rule.client_phone) return false;
            if (b.service_id !== rule.service_id) return false;
            if (b.time !== rule.time) return false;
            // Check day of week
            const bookingDate = new Date(b.date);
            if (bookingDate.getDay() !== rule.day_of_week) return false;
            return true;
          });
          
          // Delete future bookings
          for (const booking of futureBookings) {
            await base44.entities.Booking.update(booking.id, { status: 'cancelled' });
          }
        }
      }
      
      // Delete the rule
      await base44.entities.RecurringAppointment.delete(ruleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setDeleteConfirm(null);
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }) => {
      return await base44.entities.RecurringAppointment.update(id, { is_active: isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-appointments'] });
    },
  });

  // Filter rules by search
  const filteredRules = recurringRules.filter(rule => 
    rule.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rule.service_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveEdit = () => {
    if (!editingRule) return;
    
    const selectedService = services.find(s => s.id === editingRule.service_id);
    const selectedStaff = staff.find(s => s.id === editingRule.staff_id);
    
    updateRuleMutation.mutate({
      id: editingRule.id,
      updates: {
        service_id: editingRule.service_id,
        service_name: selectedService?.name,
        staff_id: editingRule.staff_id,
        staff_name: selectedStaff?.name,
        day_of_week: editingRule.day_of_week,
        time: editingRule.time,
        frequency: editingRule.frequency,
        duration: selectedService?.duration || editingRule.duration,
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  return (
    <FeatureGate feature="recurringBookings">
    <div className="min-h-screen bg-[#0C0F1D]">
      <div className="max-w-2xl mx-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-[#0C0F1D] z-20 p-4 pt-safe border-b border-gray-800/50">
          <button
            onClick={() => navigate(createPageUrl("Settings"))}
            className="flex items-center gap-2 text-[#94A3B8] mb-4 hover:text-white transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
            <span className="font-medium">חזרה</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
              <Repeat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">תורים חוזרים</h1>
              <p className="text-[#94A3B8] text-sm">{filteredRules.length} כללים פעילים</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
          <Input
            type="text"
            placeholder="חפש לפי שם לקוח או שירות..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-12 h-12 bg-[#1A1F35] border-gray-700 rounded-xl text-white placeholder:text-[#64748B]"
          />
        </div>

        {/* Rules List */}
        {filteredRules.length === 0 ? (
          <div className="bg-[#1A1F35] rounded-2xl p-8 text-center border border-gray-800">
            <Repeat className="w-12 h-12 text-[#94A3B8] mx-auto mb-4" />
            <p className="text-[#94A3B8]">
              {searchQuery ? 'לא נמצאו תורים חוזרים' : 'אין תורים חוזרים'}
            </p>
            <p className="text-[#64748B] text-sm mt-2">
              צור תור חוזר דרך יצירת תור חדש
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRules.map((rule) => (
              <div
                key={rule.id}
                className={`bg-[#1A1F35] rounded-2xl p-4 border-2 transition-all ${
                  rule.is_active ? 'border-gray-700' : 'border-gray-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center text-white font-bold">
                      {rule.client_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{rule.client_name}</h3>
                      <p className="text-sm text-[#94A3B8]">{rule.service_name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActiveMutation.mutate({ id: rule.id, isActive: !rule.is_active })}
                      className={`h-8 w-8 p-0 rounded-lg ${rule.is_active ? 'text-green-400 hover:bg-green-500/10' : 'text-yellow-400 hover:bg-yellow-500/10'}`}
                    >
                      {rule.is_active ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingRule({ ...rule })}
                      className="h-8 w-8 p-0 rounded-lg text-blue-400 hover:bg-blue-500/10"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(rule)}
                      className="h-8 w-8 p-0 rounded-lg text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-[#94A3B8]">
                    <Calendar className="w-4 h-4" />
                    <span>יום {DAY_NAMES[rule.day_of_week]}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#94A3B8]">
                    <Clock className="w-4 h-4" />
                    <span>{rule.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#94A3B8]">
                    <Repeat className="w-4 h-4" />
                    <span>{rule.frequency === 'weekly' ? 'כל שבוע' : 'כל שבועיים'}</span>
                  </div>
                  {rule.staff_name && (
                    <div className="flex items-center gap-1.5 text-[#94A3B8]">
                      <User className="w-4 h-4" />
                      <span>{rule.staff_name}</span>
                    </div>
                  )}
                </div>

                {!rule.is_active && (
                  <div className="mt-3 bg-yellow-500/10 text-yellow-400 text-xs px-3 py-1.5 rounded-lg inline-block">
                    מושהה - לא יווצרו תורים חדשים
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
        <DialogContent className="bg-[#1A1F35] border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">עריכת תור חוזר</DialogTitle>
          </DialogHeader>
          
          {editingRule && (
            <div className="space-y-4 mt-4">
              <div className="bg-[#0C0F1D] rounded-xl p-3 border border-gray-800">
                <p className="text-sm text-[#94A3B8]">לקוח</p>
                <p className="font-bold">{editingRule.client_name}</p>
              </div>

              <div>
                <Label className="text-white mb-2 block">שירות</Label>
                <Select
                  value={editingRule.service_id}
                  onValueChange={(value) => setEditingRule({ ...editingRule, service_id: value })}
                >
                  <SelectTrigger className="h-12 bg-[#0C0F1D] border-gray-700 rounded-xl text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1F35] border-gray-700">
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id} className="text-white">
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-white mb-2 block">נותן שירות</Label>
                <Select
                  value={editingRule.staff_id}
                  onValueChange={(value) => setEditingRule({ ...editingRule, staff_id: value })}
                >
                  <SelectTrigger className="h-12 bg-[#0C0F1D] border-gray-700 rounded-xl text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1F35] border-gray-700">
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-white">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-white mb-2 block">יום בשבוע</Label>
                <Select
                  value={String(editingRule.day_of_week)}
                  onValueChange={(value) => setEditingRule({ ...editingRule, day_of_week: parseInt(value) })}
                >
                  <SelectTrigger className="h-12 bg-[#0C0F1D] border-gray-700 rounded-xl text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1F35] border-gray-700">
                    {DAY_NAMES.map((day, index) => (
                      <SelectItem key={index} value={String(index)} className="text-white">
                        יום {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-white mb-2 block">שעה</Label>
                <Input
                  type="time"
                  value={editingRule.time}
                  onChange={(e) => setEditingRule({ ...editingRule, time: e.target.value })}
                  className="h-12 bg-[#0C0F1D] border-gray-700 rounded-xl text-white"
                />
              </div>

              <div>
                <Label className="text-white mb-2 block">תדירות</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setEditingRule({ ...editingRule, frequency: 'weekly' })}
                    className={`flex-1 h-12 rounded-xl transition-all ${
                      editingRule.frequency === 'weekly'
                        ? 'bg-[#FF6B35] text-white'
                        : 'bg-[#0C0F1D] text-[#94A3B8] border border-gray-700'
                    }`}
                  >
                    כל שבוע
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setEditingRule({ ...editingRule, frequency: 'biweekly' })}
                    className={`flex-1 h-12 rounded-xl transition-all ${
                      editingRule.frequency === 'biweekly'
                        ? 'bg-[#FF6B35] text-white'
                        : 'bg-[#0C0F1D] text-[#94A3B8] border border-gray-700'
                    }`}
                  >
                    כל שבועיים
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setEditingRule(null)}
                  variant="ghost"
                  className="flex-1 h-12 rounded-xl border border-gray-700 text-white"
                >
                  ביטול
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateRuleMutation.isPending}
                  className="flex-1 h-12 rounded-xl bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white"
                >
                  {updateRuleMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'שמור'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-[#1A1F35] border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-red-400">מחיקת תור חוזר</DialogTitle>
          </DialogHeader>
          
          {deleteConfirm && (
            <div className="space-y-4 mt-4">
              <p className="text-[#94A3B8]">
                האם אתה בטוח שברצונך למחוק את התור החוזר של <span className="text-white font-bold">{deleteConfirm.client_name}</span>?
              </p>

              <div className="bg-[#0C0F1D] rounded-xl p-4 border border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-white font-medium">מחק גם תורים עתידיים</p>
                    <p className="text-[#94A3B8] text-sm mt-1">
                      כל התורים העתידיים של הלקוח יבוטלו
                    </p>
                  </div>
                  <Switch
                    checked={deleteFutureBookings}
                    onCheckedChange={setDeleteFutureBookings}
                    className="data-[state=checked]:bg-red-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setDeleteConfirm(null)}
                  variant="ghost"
                  className="flex-1 h-12 rounded-xl border border-gray-700 text-white"
                >
                  ביטול
                </Button>
                <Button
                  onClick={() => deleteRuleMutation.mutate({ 
                    ruleId: deleteConfirm.id, 
                    deleteFuture: deleteFutureBookings 
                  })}
                  disabled={deleteRuleMutation.isPending}
                  className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                >
                  {deleteRuleMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'מחק'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </FeatureGate>
  );
}
