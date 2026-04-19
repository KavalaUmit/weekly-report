import React, { useState, useEffect, useRef } from 'react';
import './print.css';
import { generatePdf } from './generatePdf';
import * as api from './api';
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
  FormHelperText,
  Tooltip
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
  InsertPhoto,
  ChevronLeft,
  ChevronRight,
  PictureAsPdf
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
  const [statusList, setStatusList] = useState([]);
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
    UserID: null,
    FullName: '',
    DepartmentID: null,
    DepartmentName: '',
    UnitID: null,
    UnitName: '',
    LineID: null,
    LineName: '',
    Title: '',
    PositionNumber: null
  });
  const [lines, setLines] = useState([]);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [userError, setUserError] = useState(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const dateInputRef = useRef(null);
  const editableRef = useRef(null);
  const subEditableRefs = useRef({});

  useEffect(() => {
    // Fetch user data via Windows Authentication – backend reads User.Identity.Name
    api.getMe()
      .then(res => {
        if (res.status === 404) {
          return res.json().then(body => {
            setUserError({ type: 'not_found', windowName: body.WindowsName || body.ShortName || '' });
            throw new Error('not_found');
          });
        }
        if (!res.ok) {
          setUserError({ type: 'service_unavailable', windowName: '' });
          throw new Error('service_unavailable');
        }
        return res.json();
      })
      .then(data => {
        setUserData({
          UserID: data.UserID || null,
          FullName: data.FullName || '',
          DepartmentID: data.DepartmentID || null,
          DepartmentName: data.DepartmentName || '',
          UnitID: data.UnitID || null,
          UnitName: data.UnitName || '',
          LineID: data.LineID || null,
          LineName: data.LineName || '',
          Title: data.Title || '',
          PositionNumber: data.PositionNumber || null
        });
        if (data.LineID) setSelectedLineId(data.LineID);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Calculate current week of the year
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const currentWeek = Math.floor(diff / oneWeek) + 1;

    // Load weeks from REST service
    api.getWeeks(new Date().getFullYear())
      .then(data => {
        setWeeks(data);
        const currentWeekStr = currentWeek.toString();
        const weekObj = data.find(w => String(w.WeekNumber) === currentWeekStr);
        if (weekObj) {
          setFormData(prev => ({ ...prev, week: currentWeekStr }));
          loadActionsForWeek(weekObj.WeekNumber, weekObj.Year);
        }
      })
      .catch(error => {
        console.error('Error loading weeks:', error);
        const year = new Date().getFullYear();
        const fallbackWeeks = Array.from({ length: 52 }, (_, i) => ({ WeekNumber: i + 1, Year: year }));
        setWeeks(fallbackWeeks);
        const currentWeekStr = currentWeek.toString();
        const weekObj = fallbackWeeks.find(w => String(w.WeekNumber) === currentWeekStr);
        if (weekObj) {
          setFormData(prev => ({ ...prev, week: currentWeekStr }));
          loadActionsForWeek(weekObj.WeekNumber, weekObj.Year);
        }
      });

    // Load org lines for EVP/GM line picker
    api.getLines()
      .then(data => setLines(data))
      .catch(() => {});

    // Load action status list for StatusID lookup
    api.getActionStatuses()
      .then(data => setStatusList(data))
      .catch(() => {});

    // Load types from REST service
    api.getActionTypes()
      .then(data => {
        setTypes(data);
      })
      .catch(error => {
        console.error('Error loading types:', error);
        setTypes([
          { TypeID: null, TypeName: 'Planlama' },
          { TypeID: null, TypeName: 'Geliştirme' },
          { TypeID: null, TypeName: 'Test' },
          { TypeID: null, TypeName: 'Dokümantasyon' }
        ]);
      });
  }, []);

  const loadActionsForWeek = async (weekNumber, year, lineId = null) => {
    try {
      const list = await api.getActions(weekNumber, year, lineId);
      const actionsWithItems = await Promise.all(
        list.map(async (a) => {
          const items = await api.getActionItems(a.ActionID);
          return {
            id: a.ActionID,
            week: String(a.WeekNumber),
            type: a.TypeName,
            typeHeader: a.TypeHeader ?? '',
            includeDate: !!a.IncludeDate,
            typeSortOrder: a.TypeSortOrder ?? 0,
            date: a.ActionDate ? a.ActionDate.split('T')[0] : '',
            actionItems: items.map(i => ({ type: i.ItemType, value: i.ItemValue })),
            timestamp: new Date(a.CreatedAt).toLocaleString('tr-TR'),
            statusKey: a.StatusKey || null
          };
        })
      );
      setActions(actionsWithItems);
      const statuses = {};
      actionsWithItems.forEach(a => { if (a.statusKey) statuses[a.id] = a.statusKey; });
      setActionStatuses(statuses);
      setExpandedNodes(new Set(actionsWithItems.map(a => a.week)));
    } catch (err) {
      console.error('Error loading actions:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'week' && value) {
      const weekObj = weeks.find(w => String(w.WeekNumber) === value);
      const isHighLevel = userData.PositionNumber >= 4;
      if (weekObj) loadActionsForWeek(weekObj.WeekNumber, weekObj.Year, isHighLevel ? selectedLineId : null);
    }
    if (name === 'week') {
      setActiveCounterFilter(null);
    }
    if (value.trim()) {
      setErrors(prev => ({ ...prev, [name]: false }));
    }
  };

  const handleLineChange = (newLineId) => {
    setSelectedLineId(newLineId);
    if (formData.week) {
      const weekObj = weeks.find(w => String(w.WeekNumber) === formData.week);
      if (weekObj) loadActionsForWeek(weekObj.WeekNumber, weekObj.Year, newLineId);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const selectedType = types.find(t => t.TypeName === formData.type);
    const showDate = !formData.type || selectedType?.IncludeDate !== false;
    const newErrors = {
      week: !formData.week,
      type: !formData.type,
      date: showDate && !formData.date,
      action: !formData.actionItems.some(a => a.type === 'image' ? !!a.value : a.value.trim())
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some(err => err)) return;

    const weekObj = weeks.find(w => String(w.WeekNumber) === formData.week);
    const typeObj = types.find(t => t.TypeName === formData.type);
    const actionItems = formData.actionItems
      .filter(a => a.type === 'image' ? !!a.value : a.value.trim())
      .map(i => ({ type: i.type, value: i.value }));

    try {
      if (editingActionId) {
        await api.updateAction(editingActionId, {
          WeekID: weekObj?.WeekID,
          TypeID: typeObj?.TypeID,
          ActionDate: formData.date,
          actionItems
        });
      } else {
        await api.createAction({
          UserID: userData.UserID,
          WeekID: weekObj?.WeekID,
          TypeID: typeObj?.TypeID,
          ActionDate: formData.date,
          actionItems
        });
      }
      if (weekObj) {
        await loadActionsForWeek(weekObj.WeekNumber, weekObj.Year);
        setExpandedNodes(prev => new Set([...prev, formData.week]));
      }
    } catch (err) {
      console.error('Error saving action:', err);
    }

    setEditingActionId(null);
    setFormData({ week: formData.week, type: '', date: '', actionItems: [{ type: 'text', value: '' }] });
    setErrors({ week: false, type: false, date: false, action: false });
    if (editableRef.current) editableRef.current.innerHTML = '';
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

  const markersToHtml = (text) =>
    (text || '').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

  const htmlToMarkers = (html) =>
    html
      .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]+>/g, '');

  const renderBoldText = (text) => {
    if (!text || !text.includes('**')) return text;
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );
  };

  const handleBold = () => {
    const el = editableRef.current;
    if (!el) return;
    el.focus();
    document.execCommand('bold', false, null);
    setTimeout(() => handleActionItemChange(0, htmlToMarkers(el.innerHTML)), 0);
  };

  const handleSubBold = (index) => {
    const el = subEditableRefs.current[index];
    if (!el) return;
    el.focus();
    document.execCommand('bold', false, null);
    setTimeout(() => handleActionItemChange(index, htmlToMarkers(el.innerHTML)), 0);
  };

  const handleContentInput = (e) => {
    handleActionItemChange(0, htmlToMarkers(e.currentTarget.innerHTML));
  };

  const handleContentPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  useEffect(() => {
    if (editableRef.current) {
      editableRef.current.innerHTML = markersToHtml(formData.actionItems[0]?.value ?? '');
    }
    formData.actionItems.slice(1).forEach((item, i) => {
      const el = subEditableRefs.current[i + 1];
      if (el && item.type === 'text') el.innerHTML = markersToHtml(item.value ?? '');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingActionId]);

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

  const handleSetStatus = async (statusKey) => {
    if (selectedActionId) {
      setActionStatuses(prev => ({ ...prev, [selectedActionId]: statusKey }));
      const statusObj = statusList.find(s => s.StatusKey === statusKey);
      if (statusObj) {
        try {
          await api.patchActionStatus(selectedActionId, { StatusID: statusObj.StatusID, ChangedBy: userData.UserID });
        } catch (err) { console.error('Error saving status:', err); }
      }
    }
    handleCloseContextMenu();
  };

  const handleRemoveFromReport = async () => {
    const id = selectedActionId;
    handleCloseContextMenu();
    if (!id) return;
    setActionStatuses(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    try {
      await api.patchActionStatus(id, { StatusID: null, ChangedBy: userData.UserID });
    } catch (err) { console.error('Error clearing status:', err); }
  };

  const handleDeleteAction = async () => {
    const id = selectedActionId;
    handleCloseContextMenu();
    if (!id) return;
    setActions(prev => prev.filter(a => a.id !== id));
    setActionStatuses(prev => { const updated = { ...prev }; delete updated[id]; return updated; });
    if (editingActionId === id) setEditingActionId(null);
    try {
      await api.deleteAction(id);
    } catch (err) { console.error('Error deleting action:', err); }
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

  const handlePrint = () => generatePdf({ actions, actionStatuses, userData, weeks, formData }).catch(console.error);

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
      
      // Apply status filter - EVP/GM always see only status-assigned actions
      const forceStatusFilter = userData.PositionNumber >= 4;
      if (showOnlyWithStatus || forceStatusFilter) {
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

  if (userError) {
    return (
      <Box sx={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #003366 0%, #00447F 60%, #1464A0 100%)'
      }}>
        <Box sx={{
          background: 'white', borderRadius: 4, p: { xs: 4, md: 6 }, maxWidth: 520, width: '90%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)', textAlign: 'center'
        }}>
          <Box sx={{
            width: 72, height: 72, borderRadius: '50%', background: '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3
          }}>
            <Typography sx={{ fontSize: 36 }}>🚫</Typography>
          </Box>
          <Typography variant="h5" fontWeight={800} color="#003366" gutterBottom>
            {userError.type === 'not_found' ? 'Kullanıcı Bulunamadı' : 'Servis Kullanılamıyor'}
          </Typography>
          {userError.type !== 'not_found' && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Haftalık Rapor servisi şu an yanıt vermiyor. Lütfen daha sonra tekrar deneyin.
            </Typography>
          )}
          <Box sx={{
            background: '#f8fafc', borderRadius: 2, px: 3, py: 1.5,
            border: '1px solid #e2e8f0', display: 'inline-block'
          }}>
            <Typography variant="caption" color="text.secondary" display="block">Kullanıcı Adı</Typography>
            <Typography variant="body2" fontWeight={700} fontFamily="monospace" color="#003366">
              {userError.windowName}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg, #e8f4fb 0%, #f0fafd 100%)' }}>

      {/* ── HEADER (full width) ── */}
      <Box
        sx={{
          px: { xs: 2, sm: 3, md: 5 },
          py: { xs: '14px', md: '28px' },
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
          {/* Logo */}
          <Box
            component="img"
            src={process.env.PUBLIC_URL + '/logo.png'}
            alt="Logo"
            sx={{
              height: { xs: 36, sm: 50, md: 65 },
              width: 'auto',
            }}
          />
          <Box sx={{ width: '1px', height: { xs: 32, md: 48 }, background: 'rgba(255,255,255,0.3)' }} />
          <Box>
            <Typography variant="h4" fontWeight={800} letterSpacing={-0.5} sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem', md: '2.125rem' } }}>
              Haftalık Rapor
            </Typography>
            {(userData.PositionNumber === 1 || userData.PositionNumber === 2) && (
              <>
                <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5, lineHeight: 1.6, fontWeight: 700 }}>
                  {userData.UnitName}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.75, lineHeight: 1.6 }}>
                  {userData.DepartmentName}
                </Typography>
              </>
            )}
            {userData.PositionNumber === 3 && (
              <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5, lineHeight: 1.6, fontWeight: 700 }}>
                {userData.UnitName}
              </Typography>
            )}
            {userData.PositionNumber === 4 && (
              <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5, lineHeight: 1.6, fontWeight: 700 }}>
                {lines.find(l => l.LineID === selectedLineId)?.LineName || userData.LineName}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ textAlign: 'right', zIndex: 1 }}>
          <Box sx={{ background: 'rgba(255,255,255,0.18)', borderRadius: 3, px: 3, py: 1.5, backdropFilter: 'blur(8px)' }}>
            <Typography variant="caption" sx={{ opacity: 0.85, display: 'block' }}>
              {userData.PositionNumber >= 4 ? 'Statülü Aksiyon' : 'Toplam Aksiyon'}
            </Typography>
            <Typography variant="h4" fontWeight={800}>
              {userData.PositionNumber >= 4
                ? actions.filter(a => !!actionStatuses[a.id]).length
                : actions.length}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Container maxWidth="xl" sx={{ py: 3, px: { xs: 3, sm: 4, md: 5 }, flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ── TWO PANES ── */}
        <Grid container spacing={3} sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'flex-start', flex: 1, minHeight: 0 }}>

          {/* LEFT PANE — hidden for EVP/GM */}
          {!(userData.PositionNumber >= 4) && <Grid item sx={{
            flex: { xs: '0 0 100%', md: leftPanelOpen ? '0 0 30%' : '0 0 0%' },
            maxWidth: { xs: '100%', md: leftPanelOpen ? '30%' : '0%' },
            width: '100%', display: 'flex',
            overflow: 'hidden',
            transition: 'flex 0.3s ease, max-width 0.3s ease',
          }}>
            <Card
              elevation={0}
              sx={{
                height: 'auto',
                width: '100%',
                borderRadius: 4,
                border: '1px solid',
                borderColor: editingActionId ? '#2DCCCD' : '#c5dff0',
                boxShadow: editingActionId
                  ? '0 4px 24px rgba(45,204,205,0.18)'
                  : '0 4px 24px rgba(0,68,129,0.08)',
                transition: 'box-shadow 0.3s, border-color 0.3s',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box
                sx={{
                  background: userData.PositionNumber >= 4
                    ? 'linear-gradient(90deg, #004481, #6b7280)'
                    : editingActionId
                      ? 'linear-gradient(90deg, #1464A0, #2DCCCD)'
                      : 'linear-gradient(90deg, #004481, #1464A0)',
                  borderRadius: '16px 16px 0 0',
                  px: 3, py: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <Typography variant="h6" fontWeight={700} color="white">
                  {userData.PositionNumber >= 4 ? 'Filtrele' : editingActionId ? 'Aksiyonu Güncelle' : 'Yeni Aksiyon Ekle'}
                </Typography>
                <Tooltip title="Paneli Gizle">
                  <IconButton size="small" onClick={() => setLeftPanelOpen(false)} sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: 'white', background: 'rgba(255,255,255,0.15)' } }}>
                    <ChevronLeft />
                  </IconButton>
                </Tooltip>
              </Box>

              <CardContent sx={{ px: 3, pt: 2, pb: 2, display: 'flex', flexDirection: 'column', '&:last-child': { pb: 2 } }}>
                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column' }}>
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
                        <MenuItem key={index} value={String(week.WeekNumber)}>{week.Year}/{week.WeekNumber}. Hafta</MenuItem>
                      ))}
                    </Select>
                    {errors.week && <FormHelperText>Lütfen hafta seçin</FormHelperText>}
                  </FormControl>

                  {/* Line picker — only for EVP (4) and GM (5) */}
                  {userData.PositionNumber >= 4 && (
                    <FormControl fullWidth margin="normal">
                      <InputLabel>Hat</InputLabel>
                      <Select
                        value={selectedLineId || ''}
                        onChange={(e) => handleLineChange(e.target.value || null)}
                        label="Hat"
                        sx={{ borderRadius: 2 }}
                      >
                        {userData.PositionNumber === 5 && (
                          <MenuItem value=""><em>Tüm Hatlar</em></MenuItem>
                        )}
                        {lines.map(line => (
                          <MenuItem key={line.LineID} value={line.LineID}>{line.LineName}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}

                  {userData.PositionNumber < 4 && (<>
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
                        <MenuItem key={index} value={type.TypeName}>{type.TypeName}</MenuItem>
                      ))}
                    </Select>
                    {errors.type && <FormHelperText>Lütfen tür seçin</FormHelperText>}
                  </FormControl>

                  {(types.find(t => t.TypeName === formData.type)?.IncludeDate !== false || !formData.type) && (
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
                  )}

                  <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: errors.action ? '#d32f2f' : '#666', fontWeight: 600 }}>
                        Aksiyon {errors.action && '— En az bir aksiyon gerekli'}
                      </Typography>
                      <Tooltip title="Seçili metni kalın yap">
                        <IconButton
                          size="small"
                          onMouseDown={(e) => { e.preventDefault(); handleBold(); }}
                          sx={{ ml: 'auto', fontWeight: 900, width: 26, height: 26, fontSize: '13px', lineHeight: 1, color: '#1464A0', border: '1px solid #c5dff0', borderRadius: 1, '&:hover': { background: '#e8f4fb', borderColor: '#1464A0' } }}
                        >
                          B
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {/* Main action — contentEditable for inline bold */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                      <Box
                        ref={editableRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={handleContentInput}
                        onPaste={handleContentPaste}
                        sx={{
                          flex: 1,
                          minHeight: 130,
                          border: errors.action ? '1px solid #d32f2f' : '1px solid rgba(0,0,0,0.23)',
                          borderRadius: 2,
                          px: '14px', py: '12px',
                          outline: 'none',
                          fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
                          fontSize: '1rem',
                          lineHeight: 1.6,
                          color: 'rgba(0,0,0,0.87)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          overflowY: 'auto',
                          cursor: 'text',
                          '&:focus': { borderColor: errors.action ? '#d32f2f' : '#1464A0', borderWidth: '2px', px: '13px', py: '11px' },
                          '& strong, & b': { fontWeight: 700 },
                          '&:empty::before': { content: '"Aksiyon detayını yazın..."', color: 'rgba(0,0,0,0.42)', pointerEvents: 'none' },
                        }}
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
                            <Box
                              ref={el => { subEditableRefs.current[index] = el; }}
                              contentEditable
                              suppressContentEditableWarning
                              onInput={(e) => handleActionItemChange(index, htmlToMarkers(e.currentTarget.innerHTML))}
                              onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
                              sx={{
                                flex: 1,
                                minHeight: 52,
                                border: '1px solid rgba(0,0,0,0.23)',
                                borderRadius: 2,
                                px: '12px', py: '9px',
                                outline: 'none',
                                fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
                                fontSize: '0.95rem',
                                lineHeight: 1.5,
                                color: 'rgba(0,0,0,0.87)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                cursor: 'text',
                                '&:focus': { borderColor: '#1464A0', borderWidth: '2px', px: '11px', py: '8px' },
                                '& strong, & b': { fontWeight: 700 },
                                '&:empty::before': { content: '"Alt aksiyon detayı..."', color: 'rgba(0,0,0,0.42)', pointerEvents: 'none' },
                              }}
                            />
                          )}
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                            {item.type !== 'image' && (
                              <Tooltip title="Seçili metni kalın yap">
                                <IconButton
                                  size="small"
                                  onMouseDown={(e) => { e.preventDefault(); handleSubBold(index); }}
                                  sx={{ width: 26, height: 26, border: '1px solid #c5dff0', borderRadius: 1, color: '#1464A0', fontWeight: 700, fontSize: '13px', lineHeight: 1 }}
                                >
                                  <b>B</b>
                                </IconButton>
                              </Tooltip>
                            )}
                            <IconButton
                              onClick={() => handleRemoveActionItem(index)}
                              sx={{ color: '#ef4444', '&:hover': { background: '#fef2f2' } }}
                              size="small"
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
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
                  </>)}
                </Box>
              </CardContent>
            </Card>
          </Grid>}

          {/* RIGHT PANE */}
          <Grid item sx={{ flex: { xs: '0 0 100%', md: (userData.PositionNumber >= 4 || !leftPanelOpen) ? '0 0 100%' : '0 0 70%' }, maxWidth: { xs: '100%', md: (userData.PositionNumber >= 4 || !leftPanelOpen) ? '100%' : '70%' }, width: '100%', display: 'flex', flexDirection: 'column', transition: 'flex 0.3s ease, max-width 0.3s ease', position: 'relative' }}>

            {/* Re-open panel tab — only for non-EVP/GM */}
            {!leftPanelOpen && !(userData.PositionNumber >= 4) && (
              <Tooltip title="Formu Aç" placement="right">
                <IconButton
                  onClick={() => setLeftPanelOpen(true)}
                  sx={{
                    position: 'absolute', left: -16, top: 16, zIndex: 10,
                    width: 32, height: 32,
                    background: '#00447F', color: 'white',
                    borderRadius: '0 8px 8px 0',
                    boxShadow: '2px 2px 8px rgba(0,68,129,0.3)',
                    '&:hover': { background: '#1464A0' }
                  }}
                >
                  <ChevronRight sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}


            {/* Durum Dağılımı — pull-tab sliding panel on right edge */}
            <Box
              sx={{
                position: 'fixed',
                right: 0,
                top: '50%',
                transform: statusPanelOpen
                  ? 'translateY(-50%) translateX(0)'
                  : 'translateY(-50%) translateX(calc(100% - 10px))',
                transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                zIndex: 1300,
              }}
            >
              {/* Pull-tab */}
              <Box
                onClick={() => setStatusPanelOpen(o => !o)}
                sx={{
                  position: 'absolute', left: 0, top: '50%',
                  transform: 'translateY(-50%)',
                  width: 10, height: 72, cursor: 'pointer',
                  background: 'linear-gradient(180deg, #004481, #1464A0)',
                  borderRadius: '6px 0 0 6px',
                  boxShadow: '-2px 0 8px rgba(0,68,129,0.3)',
                }}
              />

              {/* Panel body */}
              <Box sx={{
                ml: '10px',
                background: 'white',
                borderRadius: '12px 0 0 12px',
                boxShadow: '-4px 0 24px rgba(0,68,129,0.18)',
                border: '1px solid #c5dff0',
                borderRight: 'none',
                overflow: 'hidden',
                minWidth: 180,
              }}>
                {/* Header */}
                <Box sx={{ background: 'linear-gradient(135deg, #004481, #1464A0)', px: 2, py: 1.2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'white', letterSpacing: 0.3 }}>
                    Durum Dağılımı
                  </Typography>
                  <IconButton size="small" onClick={() => setStatusPanelOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)', p: '2px', '&:hover': { color: 'white' } }}>
                    <ChevronRight sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>

                {/* Filter controls inside panel */}
                <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel sx={{ fontSize: '11px' }}>Hafta</InputLabel>
                    <Select
                      name="week"
                      value={formData.week}
                      onChange={handleInputChange}
                      label="Hafta"
                      sx={{ fontSize: '11px', borderRadius: 1.5 }}
                    >
                      <MenuItem value=""><em style={{ fontSize: '11px' }}>Seçin...</em></MenuItem>
                      {weeks.map((week, i) => (
                        <MenuItem key={i} value={String(week.WeekNumber)} sx={{ fontSize: '11px' }}>
                          {week.Year}/{week.WeekNumber}. Hafta
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {userData.PositionNumber >= 4 && (
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: '11px' }}>Line</InputLabel>
                      <Select
                        value={selectedLineId || ''}
                        onChange={(e) => handleLineChange(e.target.value || null)}
                        label="Line"
                        sx={{ fontSize: '11px', borderRadius: 1.5 }}
                      >
                        {userData.PositionNumber === 5 && (
                          <MenuItem value=""><em style={{ fontSize: '11px' }}>Tüm Hatlar</em></MenuItem>
                        )}
                        {lines.map(line => (
                          <MenuItem key={line.LineID} value={line.LineID} sx={{ fontSize: '11px' }}>{line.LineName}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Box>

                <Divider sx={{ mx: 1.5, borderColor: '#e8f4fb' }} />

                {/* Counters — vertical */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1 }}>
                  {/* Toplam — hidden for EVP/GM */}
                  {!(userData.PositionNumber >= 4) && (
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
                  )}

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
            <Card elevation={0} className="print-section" sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 4, border: '1px solid #c5dff0', boxShadow: '0 4px 24px rgba(0,68,129,0.08)' }}>
              <Box sx={{ background: 'linear-gradient(90deg, #004481, #1464A0)', borderRadius: '16px 16px 0 0', px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" fontWeight={700} color="white">Ekip Aksiyonları</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {!(userData.PositionNumber >= 4) && (
                    <Button
                      variant={showOnlyWithStatus ? 'contained' : 'outlined'}
                      size="small"
                      onClick={toggleStatusFilter}
                      startIcon={<Flag fontSize="small" />}
                      sx={{
                        fontSize: '12px', fontWeight: 600, borderRadius: 2, minWidth: 160,
                        borderColor: 'rgba(255,255,255,0.6)', color: showOnlyWithStatus ? '#004481' : 'white',
                        background: showOnlyWithStatus ? 'white' : 'rgba(255,255,255,0.15)',
                        '&:hover': { background: showOnlyWithStatus ? '#f5f3ff' : 'rgba(255,255,255,0.25)', borderColor: 'white' }
                      }}
                    >
                      {showOnlyWithStatus ? 'Tümünü Göster' : 'Rapora Eklenenler'}
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handlePrint}
                    startIcon={<PictureAsPdf fontSize="small" />}
                    className="no-print"
                    sx={{
                      fontSize: '12px', fontWeight: 600, borderRadius: 2, minWidth: 160,
                      borderColor: 'rgba(255,255,255,0.6)', color: 'white',
                      background: 'rgba(255,255,255,0.15)',
                      '&:hover': { background: 'rgba(255,255,255,0.25)', borderColor: 'white' }
                    }}
                  >
                    PDF'e Çevir
                  </Button>
                </Box>
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
                      const statusOrder = ['highlight', 'lowlight', 'waiting', 'information', 'progress'];
                      const filteredWeekActions = (activeCounterFilter
                        ? weekActions.filter(a => actionStatuses[a.id] === activeCounterFilter)
                        : weekActions
                      ).slice().sort((a, b) => {
                        const ai = statusOrder.indexOf(actionStatuses[a.id] || '');
                        const bi = statusOrder.indexOf(actionStatuses[b.id] || '');
                        return (ai === -1 ? statusOrder.length : ai) - (bi === -1 ? statusOrder.length : bi);
                      });
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
                                                {renderBoldText(main.value)}
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
                                                          {renderBoldText(item.value)}
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
