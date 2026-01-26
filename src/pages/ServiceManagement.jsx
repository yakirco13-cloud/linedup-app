import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Trash2, Clock, DollarSign, Loader2, Pencil, Palette, Check, Lock } from "lucide-react";
import { canAddService } from "@/services/subscriptionService";
import UpgradeModal from "@/components/UpgradeModal";

// Generate duration options from 5 to 90 minutes in 5-minute increments
const DURATION_OPTIONS = Array.from({ length: 18 }, (_, i) => (i + 1) * 5);

// Predefined color palette for services
const SERVICE_COLORS = [
  { name: 'כתום', value: '#FF6B35' },
  { name: 'כחול', value: '#3B82F6' },
  { name: 'ירוק', value: '#10B981' },
  { name: 'צהוב', value: '#F59E0B' },
  { name: 'אדום', value: '#EF4444' },
  { name: 'סגול', value: '#8B5CF6' },
  { name: 'ורוד', value: '#EC4899' },
  { name: 'תכלת', value: '#06B6D4' },
  { name: 'ירוק בהיר', value: '#84CC16' },
  { name: 'כתום כהה', value: '#F97316' },
];

export default function ServiceManagement() {
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [serviceLimitInfo, setServiceLimitInfo] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    duration: "30",
    price: "",
    description: "",
    color: "#FF6B35"
  });

  const { data: business } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0];
    },
    enabled: !!user?.business_id,
  });

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: () => base44.entities.Service.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Service.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Service.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Service.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", duration: "30", price: "", description: "", color: "#FF6B35" });
    setShowForm(false);
    setEditingService(null);
  };

  // Auto-assign a color based on existing services
  const getNextAvailableColor = () => {
    const usedColors = services.map(s => s.color);
    const availableColor = SERVICE_COLORS.find(c => !usedColors.includes(c.value));
    return availableColor?.value || SERVICE_COLORS[services.length % SERVICE_COLORS.length].value;
  };

  const handleAddNew = async () => {
    // Check service limit
    const limitCheck = await canAddService(business?.id);
    if (!limitCheck.allowed) {
      setServiceLimitInfo(limitCheck);
      setShowUpgradeModal(true);
      return;
    }

    setFormData({
      name: "",
      duration: "30",
      price: "",
      description: "",
      color: getNextAvailableColor()
    });
    setShowForm(true);
    setEditingService(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const serviceData = {
      business_id: business.id,
      name: formData.name,
      duration: parseInt(formData.duration),
      price: parseFloat(formData.price) || 0,
      description: formData.description,
      color: formData.color
    };

    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data: serviceData });
    } else {
      createMutation.mutate(serviceData);
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      duration: service.duration.toString(),
      price: service.price?.toString() || "",
      description: service.description || "",
      color: service.color || "#FF6B35"
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק שירות זה?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0F1D]">
      <div className="max-w-2xl mx-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-[#0C0F1D] z-20 p-4 border-b border-gray-800/50">
          <button
            onClick={() => navigate(createPageUrl("Settings"))}
            className="flex items-center gap-2 text-[#94A3B8] mb-4 hover:text-white transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
            <span className="font-medium">חזרה</span>
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">ניהול שירותים</h1>
            <Button
              onClick={handleAddNew}
              className="h-12 px-6 rounded-xl"
              style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
            >
              <Plus className="w-5 h-5 ml-2" />
              הוסף שירות
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">

        {showForm && (
          <div className="bg-[#1A1F35] rounded-2xl p-6 mb-6 border border-gray-800">
            <h2 className="text-xl font-bold mb-4">
              {editingService ? 'ערוך שירות' : 'שירות חדש'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">שם השירות *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl"
                  placeholder="לדוגמה: תספורת גברים"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration" className="text-white">משך (דקות) *</Label>
                  <Select
                    value={formData.duration}
                    onValueChange={(value) => setFormData({ ...formData, duration: value })}
                  >
                    <SelectTrigger className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl">
                      <SelectValue placeholder="בחר משך" />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((duration) => (
                        <SelectItem key={duration} value={duration.toString()}>
                          {duration} דקות
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price" className="text-white">מחיר (₪)</Label>
                  <div className="relative">
                    <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl pr-11"
                      placeholder="100"
                    />
                  </div>
                </div>
              </div>

              {/* Color Picker */}
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  צבע השירות
                </Label>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-10 h-10 rounded-xl transition-all ${
                        formData.color === color.value 
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1A1F35] scale-110' 
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    >
                      {formData.color === color.value && (
                        <Check className="w-5 h-5 text-white mx-auto" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#94A3B8]">
                  הצבע יוצג ביומן ובסטטיסטיקות
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-white">תיאור</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-[#0C0F1D] border-gray-700 text-white rounded-xl min-h-[100px]"
                  placeholder="תיאור השירות..."
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 h-12 rounded-xl text-white"
                  style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    editingService ? 'עדכן' : 'הוסף'
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={resetForm}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-gray-700 bg-[#1A1F35] text-white hover:bg-[#0C0F1D] hover:text-white"
                >
                  ביטול
                </Button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35] mx-auto" />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#94A3B8]">עדיין לא הוספת שירותים</p>
          </div>
        ) : !showForm ? (
          <div className="space-y-3">
            {services.map((service) => (
              <div 
                key={service.id} 
                className="bg-[#1A1F35] rounded-2xl p-5 border border-gray-800 overflow-hidden"
                style={{ borderRightWidth: '4px', borderRightColor: service.color || '#FF6B35' }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: service.color || '#FF6B35' }}
                      />
                      <h3 className="text-lg font-bold text-white">{service.name}</h3>
                    </div>
                    {service.description && (
                      <p className="text-[#94A3B8] text-sm mb-2 mr-5">{service.description}</p>
                    )}
                    <div className="flex gap-4 text-sm mr-5">
                      <div className="flex items-center gap-1 text-[#94A3B8]">
                        <Clock className="w-4 h-4" />
                        <span>{service.duration} דקות</span>
                      </div>
                      {service.price > 0 && (
                        <div className="flex items-center gap-1 text-[#94A3B8]">
                          <DollarSign className="w-4 h-4" />
                          <span>₪{service.price}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEdit(service)}
                      variant="ghost"
                      size="sm"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(service.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="services"
        featureNameHe="שירותים נוספים"
        description={serviceLimitInfo?.reason || `הגעת למגבלת השירותים (${serviceLimitInfo?.used || 0}/${serviceLimitInfo?.limit || 0}). שדרג לתוכנית גבוהה יותר כדי להוסיף עוד שירותים.`}
      />
    </div>
  );
}