import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  Button,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Collapse,
  Divider,
  Menu,
  Chip,
  FormHelperText
} from '@mui/material';
import {
  Save,
  CalendarMonth,
  ExpandMore,
  ExpandLess,
  Flag,
  Schedule,
  Info,
  Loop,
  RemoveCircle,
  Delete,
  Article,
  Add,
  InsertPhoto
} from '@mui/icons-material';

function App() {
  const [formData, setFormData] = useState({
    week: '',
    type: '',
    date: '',
    actionItems: [{ type: 'text', value: '' }]
  });
  
  const [weeks, setWeeks] = useState([]);
  const [types, setTypes] = useState([]);
  const [actions, setActions] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [actionStatuses, setActionStatuses] = useState({});
  const [excludedFromReport] = useState(new Set());
  const [errors, setErrors] = useState({
    week: false,
    type: false,
    date: false,
    action: false
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedActionId, setSelectedActionId] = useState(null);
  const [showOnlyWithStatus, setShowOnlyWithStatus] = useState(false);
  const [activeCounterFilter, setActiveCounterFilter] = useState(null);
  const [editingActionId, setEditingActionId] = useState(null);
  const [userData, setUserData] = useState({
    FullName: 'ÜMİT KAVALA',
    DepartmentName: 'Team Name',
    UnitName: 'İş Süreç Platformları',
    LineName: 'Company Line Name',
    Title: 'Manager'
  });
  const dateInputRef = useRef(null);

  useEffect(() => {
    // Fetch user data from REST service
    const windowName = window.name || window.location.hostname || 'HaftalikRapor';
    fetch(`http://localhost:4443/user/getuserdata?windowName=${encodeURIComponent(windowName)}`)
      .then(res => {
        if (!res.ok) throw new Error('Service unavailable');
        return res.json();
      })
      .then(data => {
        setUserData({
          FullName: data.FullName || 'ÜMİT KAVALA',
          DepartmentName: data.DepartmentName || 'Team Name',
          UnitName: data.UnitName || 'İş Süreç Platformları',
          LineName: data.LineName || 'Company Line Name',
          Title: data.Title || 'Manager'
        });
      })
      .catch(() => {
        // Service not available — use hardcoded defaults
        setUserData({
          FullName: 'ÜMİT KAVALA',
          DepartmentName: 'Team Name',
          UnitName: 'İş Süreç Platformları',
          LineName: 'Company Line Name',
          Title: 'Manager'
        });
      });
  }, []);

  useEffect(() => {
    // Calculate current week of the year
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const currentWeek = Math.floor(diff / oneWeek) + 1;

    // Load weeks from text file
    fetch('/data/weeks.txt')
      .then(response => response.text())
      .then(data => {
        const weekList = data.split('\n').filter(line => line.trim());
        setWeeks(weekList);
        // Set current week as default if it exists in the list
        const currentWeekStr = currentWeek.toString();
        if (weekList.includes(currentWeekStr)) {
          setFormData(prev => ({ ...prev, week: currentWeekStr }));
        }
      })
      .catch(error => {
        console.error('Error loading weeks:', error);
        // Fallback data
        const fallbackWeeks = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53'];
        setWeeks(fallbackWeeks);
        // Set current week as default
        const currentWeekStr = currentWeek.toString();
        if (fallbackWeeks.includes(currentWeekStr)) {
          setFormData(prev => ({ ...prev, week: currentWeekStr }));
        }
      });

    // Load types from text file
    fetch('/data/types.txt')
      .then(response => response.text())
      .then(data => {
        const typeList = data.split('\n').filter(line => line.trim());
        setTypes(typeList);
      })
      .catch(error => {
        console.error('Error loading types:', error);
        // Fallback data
        setTypes(['Planlama', 'Geliştirme', 'Test', 'Dokümantasyon']);
      });
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === 'week') {
      setActiveCounterFilter(null);
    }
    if (value.trim()) {
      setErrors(prev => ({ ...prev, [name]: false }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const newErrors = {
      week: !formData.week,
      type: !formData.type,
      date: !formData.date,
      action: !formData.actionItems.some(a => a.type === 'image' ? !!a.value : a.value.trim())
    };
    
    setErrors(newErrors);
    
    if (Object.values(newErrors).some(error => error)) {
      return;
    }

    if (editingActionId) {
      // Update existing action
      setActions(prev => prev.map(action => 
        action.id === editingActionId 
          ? { ...action, ...formData, actionItems: formData.actionItems.filter(a => a.type === 'image' ? !!a.value : a.value.trim()), timestamp: new Date().toLocaleString('tr-TR') }
          : action
      ));
      setEditingActionId(null);
    } else {
      // Create new action
      const newAction = {
        id: Date.now(),
        ...formData,
        actionItems: formData.actionItems.filter(a => a.type === 'image' ? !!a.value : a.value.trim()),
        timestamp: new Date().toLocaleString('tr-TR')
      };

      setActions(prev => [...prev, newAction]);
      
      // Auto-expand the week for the new action
      setExpandedNodes(prev => new Set([...prev, formData.week]));
    }
    
    // Reset form and errors (keep week selected)
    setFormData({
      week: formData.week,
      type: '',
      date: '',
      actionItems: [{ type: 'text', value: '' }]
    });
    setErrors({
      week: false,
      type: false,
      date: false,
      action: false
    });
  };

  const handleActionItemChange = (index, value) => {
    setFormData(prev => {
      const updated = [...prev.actionItems];
      updated[index] = { ...updated[index], value };
      return { ...prev, actionItems: updated };
    });
    if (value.trim()) setErrors(prev => ({ ...prev, action: false }));
  };

  const handleAddActionItem = (type) => {
    setFormData(prev => ({ ...prev, actionItems: [...prev.actionItems, { type, value: '' }] }));
  };

  const handleImageUpload = (index, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData(prev => {
        const updated = [...prev.actionItems];
        updated[index] = { ...updated[index], value: e.target.result };
        return { ...prev, actionItems: updated };
      });
      setErrors(prev => ({ ...prev, action: false }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveActionItem = (index) => {
    setFormData(prev => {
      const updated = prev.actionItems.filter((_, i) => i !== index);
      return { ...prev, actionItems: updated.length ? updated : [{ type: 'text', value: '' }] };
    });
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleContextMenu = (e, actionId) => {
    e.preventDefault();
    setSelectedActionId(actionId);
    setAnchorEl(e.currentTarget);
  };

  const handleCloseContextMenu = () => {
    setAnchorEl(null);
    setSelectedActionId(null);
  };

  const handleSetStatus = (status) => {
    if (selectedActionId) {
      setActionStatuses(prev => ({ ...prev, [selectedActionId]: status }));
    }
    handleCloseContextMenu();
  };

  const handleRemoveFromReport = () => {
    if (selectedActionId) {
      setActionStatuses(prev => {
        const updated = { ...prev };
        delete updated[selectedActionId];
        return updated;
      });
    }
    handleCloseContextMenu();
  };

  const handleDeleteAction = () => {
    if (selectedActionId) {
      setActions(prev => prev.filter(a => a.id !== selectedActionId));
    }
    handleCloseContextMenu();
  };

  const handleActionClick = (action) => {
    setEditingActionId(action.id);
    setFormData({
      week: action.week,
      type: action.type,
      date: action.date,
      actionItems: action.actionItems?.length
        ? action.actionItems.map(a => typeof a === 'string' ? { type: 'text', value: a } : a)
        : [{ type: 'text', value: action.action || '' }]
    });
  };

  const handleCancelEdit = () => {
    setEditingActionId(null);
    setFormData({
      week: formData.week,
      type: '',
      date: '',
      actionItems: [{ type: 'text', value: '' }]
    });
    setErrors({
      week: false,
      type: false,
      date: false,
      action: false
    });
  };

  const toggleStatusFilter = () => {
    setShowOnlyWithStatus(prev => !prev);
  };

  const groupActionsByWeek = () => {
    const grouped = {};
    actions.filter(a => !excludedFromReport.has(a.id)).forEach(action => {
      // Filter by selected week - only show selected week's actions
      if (formData.week && action.week !== formData.week) {
        return; // Skip if not the selected week
      }
      
      // Apply status filter - show only actions with any status assigned
      if (showOnlyWithStatus) {
        const actionStatus = actionStatuses[action.id];
        if (!actionStatus) {
          return; // Skip this action if it has no status
        }
      }
      
      if (!grouped[action.week]) {
        grouped[action.week] = [];
      }
      grouped[action.week].push(action);
    });
    return grouped;
  };

  const groupedActions = groupActionsByWeek();

  const statusMeta = [
    { key: 'highlight',   label: 'Highlight', color: '#ef4444', bg: '#fef2f2' },
    { key: 'lowlight',    label: 'LowLight',  color: '#6b7280', bg: '#f9fafb' },
    { key: 'waiting',     label: 'Waiting',   color: '#f59e0b', bg: '#fffbeb' },
    { key: 'information', label: 'Info',      color: '#3b82f6', bg: '#eff6ff' },
    { key: 'progress',    label: 'Progress',  color: '#10b981', bg: '#ecfdf5' },
  ];

  const getBorderColor = (id) => {
    if (editingActionId === id) return '#1464A0';
    const s = actionStatuses[id];
    if (!s) return 'transparent';
    const found = statusMeta.find(m => m.key === s);
    return found ? found.color : 'transparent';
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(160deg, #e8f4fb 0%, #f0fafd 100%)' }}>

      {/* ── HEADER (full width) ── */}
      <Box
        sx={{
          px: 5,
          py: '28px',
          background: '#00447F',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 8px 32px rgba(0,68,129,0.35)',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Box sx={{ position: 'absolute', right: -40, top: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <Box sx={{ position: 'absolute', right: 100, bottom: -70, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {/* BBVA Logo */}
          <Box
            component="img"
            src="/logo.png"
            alt="Garanti BBVA"
            sx={{
              height: 65,
              width: 'auto',
            }}
          />
          <Box sx={{ width: '1px', height: 48, background: 'rgba(255,255,255,0.3)' }} />
          <Box>
            <Typography variant="h4" fontWeight={800} letterSpacing={-0.5}>
              Haftalık Rapor
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5, lineHeight: 1.6, fontWeight: 700 }}>
              {userData.LineName}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.7, lineHeight: 1.6 }}>
              {userData.DepartmentName}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ textAlign: 'right', zIndex: 1 }}>
          <Box sx={{ background: 'rgba(255,255,255,0.18)', borderRadius: 3, px: 3, py: 1.5, backdropFilter: 'blur(8px)' }}>
            <Typography variant="caption" sx={{ opacity: 0.85, display: 'block' }}>Toplam Aksiyon</Typography>
            <Typography variant="h4" fontWeight={800}>{actions.length}</Typography>
          </Box>
        </Box>
      </Box>

      <Container maxWidth="xl" sx={{ py: 3 }}>

        {/* ── TWO PANES ── */}
        <Grid container spacing={3} sx={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>

          {/* LEFT PANE */}
          <Grid item sx={{ flex: '0 0 35%', maxWidth: '35%', display: 'flex' }}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                width: '100%',
                borderRadius: 4,
                border: '1px solid',
                borderColor: editingActionId ? '#2DCCCD' : '#c5dff0',
                boxShadow: editingActionId
                  ? '0 4px 24px rgba(45,204,205,0.18)'
                  : '0 4px 24px rgba(0,68,129,0.08)',
                transition: 'box-shadow 0.3s, border-color 0.3s',
              }}
            >
              <Box
                sx={{
                  background: editingActionId
                    ? 'linear-gradient(90deg, #1464A0, #2DCCCD)'
                    : 'linear-gradient(90deg, #004481, #1464A0)',
                  borderRadius: '16px 16px 0 0',
                  px: 3, py: 2,
                  display: 'flex', alignItems: 'center', gap: 1.5,
                }}
              >
                <Typography variant="h6" fontWeight={700} color="white">
                  {editingActionId ? 'Aksiyonu Güncelle' : 'Yeni Aksiyon Ekle'}
                </Typography>
              </Box>

              <CardContent sx={{ px: 3, pt: 2 }}>
                <Box component="form" onSubmit={handleSubmit}>
                  <FormControl fullWidth margin="normal" error={errors.week}>
                    <InputLabel>Hafta</InputLabel>
                    <Select
                      name="week"
                      value={formData.week}
                      onChange={handleInputChange}
                      label="Hafta"
                      sx={{ borderRadius: 2, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1464A0' } }}
                    >
                      <MenuItem value=""><em>Hafta seçin...</em></MenuItem>
                      {weeks.map((week, index) => (
                        <MenuItem key={index} value={week}>{week}. Hafta</MenuItem>
                      ))}
                    </Select>
                    {errors.week && <FormHelperText>Lütfen hafta seçin</FormHelperText>}
                  </FormControl>

                  <FormControl fullWidth margin="normal" error={errors.type}>
                    <InputLabel>Tür</InputLabel>
                    <Select
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      label="Tür"
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value=""><em>Tür seçin...</em></MenuItem>
                      {types.map((type, index) => (
                        <MenuItem key={index} value={type}>{type}</MenuItem>
                      ))}
                    </Select>
                    {errors.type && <FormHelperText>Lütfen tür seçin</FormHelperText>}
                  </FormControl>

                  <TextField
                    fullWidth margin="normal" type="date" name="date"
                    label="Tarih" value={formData.date} onChange={handleInputChange}
                    error={errors.date} helperText={errors.date ? "Lütfen tarih girin" : ""}
                    InputLabelProps={{ shrink: true }} inputRef={dateInputRef}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 }, '& input[type="date"]::-webkit-calendar-picker-indicator': { display: 'none' } }}
                    InputProps={{
                      endAdornment: (
                        <IconButton onClick={() => dateInputRef.current?.showPicker?.()}>
                          <CalendarMonth sx={{ color: '#1464A0' }} />
                        </IconButton>
                      )
                    }}
                  />

                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ color: errors.action ? '#d32f2f' : '#666', fontWeight: 600, mb: 0.5, display: 'block' }}>
                      Aksiyon {errors.action && '— En az bir aksiyon gerekli'}
                    </Typography>

                    {/* Main action — text only */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                      <TextField
                        fullWidth multiline rows={2}
                        value={formData.actionItems[0]?.value ?? ''}
                        onChange={(e) => handleActionItemChange(0, e.target.value)}
                        error={errors.action}
                        placeholder="Aksiyon detayını yazın..."
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Box>

                    {/* Sub-entries — text or image */}
                    {formData.actionItems.slice(1).map((item, i) => {
                      const index = i + 1;
                      return (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1, pl: 3 }}>
                          <Box sx={{ mt: 1.2, color: '#1464A0', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>•</Box>
                          {item.type === 'image' ? (
                            <Box sx={{ flex: 1 }}>
                              {item.value ? (
                                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                                  <Box
                                    component="img"
                                    src={item.value}
                                    alt="sub-entry"
                                    sx={{ maxHeight: 120, maxWidth: '100%', borderRadius: 2, border: '1px solid #c5dff0' }}
                                  />
                                  <IconButton
                                    size="small"
                                    onClick={() => handleActionItemChange(index, '')}
                                    sx={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', color: 'white', p: '2px', '&:hover': { background: 'rgba(0,0,0,0.7)' } }}
                                  >
                                    <Delete sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Box>
                              ) : (
                                <Box
                                  component="label"
                                  sx={{
                                    display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5,
                                    border: '2px dashed #aed6f1', borderRadius: 2, cursor: 'pointer',
                                    color: '#1464A0', fontWeight: 600, fontSize: '13px',
                                    '&:hover': { background: '#e8f4fb', borderColor: '#1464A0' }
                                  }}
                                >
                                  <InsertPhoto fontSize="small" />
                                  Görsel seçin...
                                  <input
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={(e) => handleImageUpload(index, e.target.files[0])}
                                  />
                                </Box>
                              )}
                            </Box>
                          ) : (
                            <TextField
                              fullWidth multiline rows={2}
                              value={item.value}
                              onChange={(e) => handleActionItemChange(index, e.target.value)}
                              placeholder="Alt aksiyon detayı..."
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                          )}
                          <IconButton
                            onClick={() => handleRemoveActionItem(index)}
                            sx={{ mt: 0.5, color: '#ef4444', '&:hover': { background: '#fef2f2' } }}
                            size="small"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      );
                    })}

                    {/* Split dropdown button */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                      <Box sx={{ display: 'flex', border: '1px solid #1464A0', borderRadius: 2, overflow: 'hidden' }}>
                        <Button
                          size="small"
                          startIcon={<Add fontSize="small" />}
                          onClick={() => handleAddActionItem('text')}
                          sx={{
                            borderRadius: 0, borderRight: '1px solid #1464A0', color: '#1464A0',
                            fontWeight: 600, fontSize: '12px', px: 1.5,
                            '&:hover': { background: '#e8f4fb' }
                          }}
                        >
                          Metin Ekle
                        </Button>
                        <Button
                          size="small"
                          startIcon={<InsertPhoto fontSize="small" />}
                          onClick={() => handleAddActionItem('image')}
                          sx={{
                            borderRadius: 0, color: '#1464A0',
                            fontWeight: 600, fontSize: '12px', px: 1.5,
                            '&:hover': { background: '#e8f4fb' }
                          }}
                        >
                          Görsel Ekle
                        </Button>
                      </Box>
                    </Box>
                  </Box>

                  <Button
                    type="submit" variant="contained" fullWidth
                    startIcon={<Save />}
                    sx={{
                      mt: 2, py: 1.3, borderRadius: 2, fontWeight: 700, fontSize: '15px',
                      background: editingActionId
                        ? 'linear-gradient(135deg, #1464A0, #2DCCCD)'
                        : 'linear-gradient(135deg, #004481, #1464A0)',
                      boxShadow: '0 4px 14px rgba(0,68,129,0.4)',
                      '&:hover': { boxShadow: '0 6px 20px rgba(0,68,129,0.55)', transform: 'translateY(-1px)' },
                      transition: 'all 0.2s',
                    }}
                  >
                    {editingActionId ? 'Güncelle' : 'Kaydet'}
                  </Button>

                  {editingActionId && (
                    <Button
                      variant="outlined" fullWidth onClick={handleCancelEdit}
                      sx={{ mt: 1, borderRadius: 2, fontWeight: 600, borderColor: '#1464A0', color: '#1464A0' }}
                    >
                      İptal
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* RIGHT PANE */}
          <Grid item sx={{ flex: '0 0 65%', maxWidth: '65%', display: 'flex', flexDirection: 'column' }}>

            {/* Durum Dağılımı — fixed vertical floating panel on right edge */}
            <Box
              sx={{
                position: 'fixed',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%) translateX(calc(100% - 10px))',
                transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                zIndex: 1300,
                '&:hover': {
                  transform: 'translateY(-50%) translateX(0)',
                },
              }}
            >
              {/* Pull-tab visible edge */}
              <Box sx={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 10,
                height: 72,
                background: 'linear-gradient(180deg, #004481, #1464A0)',
                borderRadius: '6px 0 0 6px',
                boxShadow: '-2px 0 8px rgba(0,68,129,0.3)',
              }} />

              {/* Panel body */}
              <Box sx={{
                ml: '10px',
                background: 'white',
                borderRadius: '12px 0 0 12px',
                boxShadow: '-4px 0 24px rgba(0,68,129,0.18)',
                border: '1px solid #c5dff0',
                borderRight: 'none',
                overflow: 'hidden',
                minWidth: 120,
              }}>
                {/* Header */}
                <Box sx={{ background: 'linear-gradient(135deg, #004481, #1464A0)', px: 2, py: 1.2, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'white', letterSpacing: 0.3 }}>
                    Durum Dağılımı
                  </Typography>
                </Box>

                {/* Counters — vertical */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1 }}>
                  {/* Toplam */}
                  <Box
                    onClick={() => setActiveCounterFilter(null)}
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      px: 1.5, py: 0.75, borderRadius: 1.5, cursor: 'pointer',
                      background: activeCounterFilter === null ? 'linear-gradient(135deg, #aed6f1, #cce4f5)' : '#f5faff',
                      border: activeCounterFilter === null ? '2px solid #004481' : '1px solid #aed6f1',
                      transition: 'all 0.2s',
                      '&:hover': { boxShadow: '0 2px 8px rgba(0,68,129,0.15)' }
                    }}
                  >
                    <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#004481' }}>Toplam</Typography>
                    <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#004481', ml: 1 }}>
                      {(formData.week ? actions.filter(a => a.week === formData.week) : actions).length}
                    </Typography>
                  </Box>

                  {/* Status counters */}
                  {statusMeta.map(s => {
                    const isActive = activeCounterFilter === s.key;
                    const weekActions = formData.week ? actions.filter(a => a.week === formData.week) : actions;
                    const count = weekActions.filter(a => actionStatuses[a.id] === s.key).length;
                    return (
                      <Box
                        key={s.key}
                        onClick={() => setActiveCounterFilter(isActive ? null : s.key)}
                        sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          px: 1.5, py: 0.75, borderRadius: 1.5, cursor: 'pointer',
                          background: isActive ? s.bg : '#fafafa',
                          border: isActive ? `2px solid ${s.color}` : `1px solid ${s.color}25`,
                          transition: 'all 0.2s',
                          boxShadow: isActive ? `0 2px 8px ${s.color}30` : 'none',
                          '&:hover': { background: s.bg, boxShadow: `0 2px 6px ${s.color}25` }
                        }}
                      >
                        <Typography sx={{ fontSize: '11px', fontWeight: 600, color: s.color }}>{s.label}</Typography>
                        <Typography sx={{ fontSize: '15px', fontWeight: 800, color: s.color, ml: 1 }}>{count}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>

            {/* Ekip Aksiyonları */}
            <Card elevation={0} sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 4, border: '1px solid #c5dff0', boxShadow: '0 4px 24px rgba(0,68,129,0.08)' }}>
              <Box sx={{ background: 'linear-gradient(90deg, #004481, #1464A0)', borderRadius: '16px 16px 0 0', px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" fontWeight={700} color="white">Ekip Aksiyonları</Typography>
                <Button
                  variant={showOnlyWithStatus ? 'contained' : 'outlined'}
                  size="small"
                  onClick={toggleStatusFilter}
                  startIcon={<Flag fontSize="small" />}
                  sx={{
                    fontSize: '12px', fontWeight: 600, borderRadius: 2,
                    borderColor: 'rgba(255,255,255,0.6)', color: showOnlyWithStatus ? '#004481' : 'white',
                    background: showOnlyWithStatus ? 'white' : 'rgba(255,255,255,0.15)',
                    '&:hover': { background: showOnlyWithStatus ? '#f5f3ff' : 'rgba(255,255,255,0.25)', borderColor: 'white' }
                  }}
                >
                  {showOnlyWithStatus ? 'Tümünü Göster' : 'Statülü Olanlar'}
                </Button>
              </Box>

              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 2, pt: 2 }}>
                {actions.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #cce4f5, #e8f4fb)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                      <Article sx={{ fontSize: 36, color: '#1464A0' }} />
                    </Box>
                    <Typography variant="h6" color="text.secondary" fontWeight={600}>Henüz kayıt yok</Typography>
                    <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>Yeni bir aksiyon ekleyerek başlayın</Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {Object.entries(groupedActions).map(([week, weekActions]) => {
                      const filteredWeekActions = activeCounterFilter
                        ? weekActions.filter(a => actionStatuses[a.id] === activeCounterFilter)
                        : weekActions;
                      if (filteredWeekActions.length === 0) return null;
                      return (
                      <Box key={week} sx={{ mb: 1 }}>
                        <ListItem
                          button
                          onClick={() => toggleNode(week)}
                          sx={{
                            borderRadius: 3,
                            mb: 0.5,
                            background: 'linear-gradient(90deg, #e8f4fb, #d6eef9)',
                            border: '1px solid #aed6f1',
                            '&:hover': { background: 'linear-gradient(90deg, #cce4f5, #b8d8f0)' },
                            transition: 'background 0.2s',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: 'linear-gradient(135deg, #004481, #1464A0)', flexShrink: 0 }} />
                            <Typography fontWeight={700} color="#004481">
                              {week}. Hafta
                            </Typography>
                            <Chip label={`${weekActions.length} aksiyon`} size="small" sx={{ ml: 0.5, fontWeight: 600, fontSize: '11px', background: '#004481', color: 'white' }} />
                          </Box>
                          {expandedNodes.has(week)
                            ? <ExpandLess sx={{ color: '#1464A0' }} />
                            : <ExpandMore sx={{ color: '#1464A0' }} />}
                        </ListItem>

                        <Collapse in={expandedNodes.has(week)} timeout="auto" unmountOnExit>
                          <List component="div" disablePadding sx={{ pl: 1 }}>
                            {filteredWeekActions.map(action => {
                              const borderColor = getBorderColor(action.id);
                              const isEditing = editingActionId === action.id;
                              const sm = statusMeta.find(m => m.key === actionStatuses[action.id]);
                              return (
                                <ListItem
                                  key={action.id}
                                  sx={{
                                    mb: 0.75,
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    background: isEditing ? '#e8f4fb' : sm ? sm.bg : 'white',
                                    border: `1px solid ${borderColor !== 'transparent' ? borderColor + '50' : '#f0f0f0'}`,
                                    borderLeft: `4px solid ${borderColor}`,
                                    '&:hover': { background: isEditing ? '#cce4f5' : sm ? sm.bg : '#fafafa', transform: 'translateX(2px)' },
                                    transition: 'all 0.15s',
                                    boxShadow: isEditing ? '0 2px 8px rgba(0,68,129,0.15)' : 'none',
                                  }}
                                  onClick={() => handleActionClick(action)}
                                  onContextMenu={(e) => handleContextMenu(e, action.id)}
                                >
                                  <ListItemText
                                    primary={
                                      <Box>
                                        {/* Header row: type chip + date */}
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                          <Chip
                                            label={action.type}
                                            size="small"
                                            sx={{
                                              fontWeight: 700, fontSize: '11px', flexShrink: 0,
                                              background: sm ? sm.color : '#1464A0',
                                              color: 'white', borderRadius: '6px',
                                            }}
                                          />
                                          <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto', flexShrink: 0, fontStyle: 'italic' }}>
                                            {userData.FullName} — {action.date}
                                          </Typography>
                                        </Box>

                                        {(() => {
                                          const rawItems = action.actionItems?.length ? action.actionItems : [{ type: 'text', value: action.action || '' }];
                                          const items = rawItems.map(a => typeof a === 'string' ? { type: 'text', value: a } : a);
                                          const hasSubEntries = items.length > 1;
                                          const main = items[0];
                                          return (
                                            <Box>
                                              {/* Main action text */}
                                              <Typography
                                                variant="body2"
                                                sx={{ fontWeight: 600, color: '#1a2a3a', lineHeight: 1.6, wordWrap: 'break-word', whiteSpace: 'normal' }}
                                              >
                                                {main.value}
                                              </Typography>

                                              {/* Sub-entries with vertical connector line */}
                                              {hasSubEntries && (
                                                <Box sx={{ mt: 0.75, pl: 1.5, borderLeft: '2px solid #c5dff0', ml: 0.5 }}>
                                                  {items.slice(1).map((item, i) => (
                                                    <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: i > 0 ? 0.5 : 0 }}>
                                                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', background: '#1464A0', flexShrink: 0, mt: '7px' }} />
                                                      {item.type === 'image' ? (
                                                        <Box
                                                          component="img"
                                                          src={item.value}
                                                          alt="attachment"
                                                          sx={{ maxHeight: 100, maxWidth: '100%', borderRadius: 1.5, border: '1px solid #c5dff0', mt: 0.25 }}
                                                        />
                                                      ) : (
                                                        <Typography
                                                          variant="body2"
                                                          sx={{ color: '#3a4a5a', lineHeight: 1.6, wordWrap: 'break-word', whiteSpace: 'normal' }}
                                                        >
                                                          {item.value}
                                                        </Typography>
                                                      )}
                                                    </Box>
                                                  ))}
                                                </Box>
                                              )}
                                            </Box>
                                          );
                                        })()}
                                      </Box>
                                    }
                                  />
                                </ListItem>
                              );
                            })}
                          </List>
                        </Collapse>
                      </Box>
                    );
                  })}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* CONTEXT MENU */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleCloseContextMenu}
          PaperProps={{ sx: { borderRadius: 3, minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '1px solid #e8eaf6' } }}
        >
          <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #f0f0f0' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.5}>Statü Belirle</Typography>
          </Box>
          {[
            { key: 'highlight',   label: 'Highlight',            icon: <Flag fontSize="small" />,       color: '#ef4444' },
            { key: 'lowlight',    label: 'LowLight',             icon: <Flag fontSize="small" />,       color: '#6b7280' },
            { key: 'waiting',     label: 'Waiting For Support',  icon: <Schedule fontSize="small" />,   color: '#f59e0b' },
            { key: 'information', label: 'Information',          icon: <Info fontSize="small" />,       color: '#3b82f6' },
            { key: 'progress',    label: 'Progress',             icon: <Loop fontSize="small" />,       color: '#10b981' },
          ].map(item => (
            <MenuItem key={item.key} onClick={() => handleSetStatus(item.key)} sx={{ gap: 1.5, py: 1, '&:hover': { background: `${item.color}15` } }}>
              <Box sx={{ color: item.color }}>{item.icon}</Box>
              <Typography variant="body2" fontWeight={600} sx={{ color: item.color }}>{item.label}</Typography>
            </MenuItem>
          ))}
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={handleRemoveFromReport} sx={{ gap: 1.5, py: 1, color: 'text.secondary', '&:hover': { background: '#fff5f5' } }}>
            <RemoveCircle fontSize="small" sx={{ color: '#ef4444' }} />
            <Typography variant="body2" fontWeight={600}>Rapordan Çıkar</Typography>
          </MenuItem>
          <MenuItem onClick={handleDeleteAction} sx={{ gap: 1.5, py: 1, '&:hover': { background: '#fff5f5' } }}>
            <Delete fontSize="small" sx={{ color: '#ef4444' }} />
            <Typography variant="body2" fontWeight={600} color="error">Sil</Typography>
          </MenuItem>
        </Menu>

      </Container>
    </Box>
  );
}

export default App;
