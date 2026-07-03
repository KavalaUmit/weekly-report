import React, { useState, useEffect, useRef } from 'react';
import './print.css';
import { generatePdf } from './generatePdf';
import { generateWord } from './generateWord';
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
  Tooltip,
  FormControlLabel,
  Checkbox
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
  Description as WordIcon,
  Add,
  InsertPhoto,
  ChevronLeft,
  ChevronRight,
  PictureAsPdf,
  MoreHoriz,
  FilterList,
  People,
  Done
} from '@mui/icons-material';

function App() {
  const [formData, setFormData] = useState({
    week: '',
    type: '',
    date: '',
    project: '',
    gainType: '',
    updatedEffort: '',
    effortGain: '',
    ttmGain: '',
    actionItems: [{ type: 'text', value: '' }]
  });
  
  const [weeks, setWeeks] = useState([]);
  const [types, setTypes] = useState([]);
  const [gainTypes, setGainTypes] = useState([]);
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
  const [filterMyTeam, setFilterMyTeam] = useState(true);
  const [showOnlyMyUnit, setShowOnlyMyUnit] = useState(true);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [activeCounterFilter, setActiveCounterFilter] = useState(null);
  const [editingActionId, setEditingActionId] = useState(null);
  const [userData, setUserData] = useState({
    UserID: null,
    WindowsName: '',
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
  const [divisions, setDivisions] = useState([]);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [userError, setUserError] = useState(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const dateInputRef = useRef(null);
  const editableRef = useRef(null);
  const subEditableRefs = useRef({});
  const positionNumber = Number(userData.PositionNumber);
  const isGeneralManager = positionNumber === 1;
  const isHighLevelView = positionNumber === 1 || positionNumber === 2;

  const selectedDivision = selectedLineId
    ? divisions.find(d => String(d.DivisionId) === String(selectedLineId))
    : divisions.find(d => d.Units?.some(u => u.UnitId === userData.UnitID));
  const selectedDivisionContainsMyUnit = selectedDivision?.Units?.some(u => u.UnitId === userData.UnitID) ?? true;

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
          WindowsName: data.WindowsName || '',
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

    api.getDivisionHierarchy()
      .then(data => setDivisions(data || []))
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

    // Load gain types for AI Kazanımları from backend config
    api.getGainTypes()
      .then(list => setGainTypes(Array.isArray(list) ? list : []))
      .catch(() => setGainTypes(['Maliyet-Kalite']));
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
            fullName: a.FullName || '',
            departmentName: a.DepartmentName || a.UnitName || a.LineName || '',
            departmentId: a.DepartmentID || null,
            unitId: a.UnitID || null,
            project: a.Project || '',
            gainType: a.GainType || '',
            updatedEffort: a.UpdatedEffort || '',
            effortGain: a.EffortGain || '',
            ttmGain: a.TTMGain || '',
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
      const weekNodes = actionsWithItems.map(a => `week-${a.week}`);
      setExpandedNodes(new Set(['unit-mine', ...weekNodes]));
    } catch (err) {
      console.error('Error loading actions:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'week' && value) {
      const weekObj = weeks.find(w => String(w.WeekNumber) === value);
      if (weekObj) loadActionsForWeek(weekObj.WeekNumber, weekObj.Year, selectedLineId);
    }
    if (name === 'week') {
      setActiveCounterFilter(null);
      if (editingActionId) {
        setEditingActionId(null);
        setFormData(prev => ({ week: value, type: '', date: '', actionItems: [{ type: 'text', value: '' }] }));
        setErrors({ week: false, type: false, date: false, action: false });
        if (editableRef.current) editableRef.current.textContent = '';
        return;
      }
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
    const showDate = !!selectedType?.IncludeDate;
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
          ActionDate: showDate ? formData.date : '1900-01-01',
          LineID: userData.LineID,
          UnitID: userData.UnitID,
          DepartmentID: userData.DepartmentID,
          WindowsUser: userData.WindowsName,
          UserFullName: userData.FullName,
          Project: formData.project || null,
          GainType: formData.gainType || null,
          UpdatedEffort: formData.updatedEffort || null,
          EffortGain: formData.effortGain || null,
          TTMGain: formData.ttmGain || null,
          actionItems
        });
      } else {
        await api.createAction({
          UserID: userData.UserID,
          WeekID: weekObj?.WeekID,
          TypeID: typeObj?.TypeID,
          ActionDate: showDate ? formData.date : '1900-01-01',
          LineID: userData.LineID,
          UnitID: userData.UnitID,
          DepartmentID: userData.DepartmentID,
          WindowsUser: userData.WindowsName,
          UserFullName: userData.FullName,
          Project: formData.project || null,
          GainType: formData.gainType || null,
          UpdatedEffort: formData.updatedEffort || null,
          EffortGain: formData.effortGain || null,
          TTMGain: formData.ttmGain || null,
          actionItems
        });
      }
      if (weekObj) {
        await loadActionsForWeek(weekObj.WeekNumber, weekObj.Year);
        setExpandedNodes(prev => new Set([...prev, 'unit-mine', `week-${formData.week}`]));
      }
    } catch (err) {
      console.error('Error saving action:', err);
    }

    setEditingActionId(null);
    setFormData({ week: formData.week, type: '', date: '', project: '', gainType: '', updatedEffort: '', effortGain: '', ttmGain: '', actionItems: [{ type: 'text', value: '' }] });
    setErrors({ week: false, type: false, date: false, action: false });
    if (editableRef.current) editableRef.current.textContent = '';
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
    document.execCommand('bold', false, null); // NOSONAR — no Range API equivalent for toggle
    setTimeout(() => handleActionItemChange(0, htmlToMarkers(el.innerHTML)), 0);
  };

  const handleSubBold = (index) => {
    const el = subEditableRefs.current[index];
    if (!el) return;
    el.focus();
    document.execCommand('bold', false, null); // NOSONAR — no Range API equivalent for toggle
    setTimeout(() => handleActionItemChange(index, htmlToMarkers(el.innerHTML)), 0);
  };

  const handleContentInput = (e) => {
    handleActionItemChange(0, htmlToMarkers(e.currentTarget.innerHTML));
  };

  const handleContentPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    handleActionItemChange(0, htmlToMarkers(e.currentTarget.innerHTML));
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
      project: action.project || '',
      gainType: action.gainType || '',
      updatedEffort: action.updatedEffort || '',
      effortGain: action.effortGain || '',
      ttmGain: action.ttmGain || '',
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
      project: '',
      gainType: '',
      updatedEffort: '',
      effortGain: '',
      ttmGain: '',
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
  const handleExportWord = () => { setExportMenuAnchor(null); generateWord({ actions, actionStatuses, userData, weeks, formData }).catch(console.error); };
  const handleExportPdf  = () => { setExportMenuAnchor(null); handlePrint(); };
  const sanitizeFileName = (value) => String(value || '').trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '_') || 'Birim';
  const getBulkExportUnits = () => {
    const sourceUnits = selectedDivision?.Units?.length
      ? selectedDivision.Units
      : divisions.flatMap(d => d.Units || []);
    return [...new Map(sourceUnits.map(u => [u.UnitId, u])).values()]
      .slice()
      .sort((a, b) => String(a.UnitName || '').localeCompare(String(b.UnitName || ''), 'tr'));
  };
  const getUnitExportActions = (unitId) => actions.filter(action => {
    if (excludedFromReport.has(action.id)) return false;
    if (formData.week && action.week !== formData.week) return false;
    return action.unitId === unitId;
  });
  const getBulkExportUserData = () => ({
    ...userData,
    UnitName: '',
    LineID: selectedDivision?.DivisionId ?? userData.LineID,
    LineName: selectedDivision?.DivisionName ?? userData.LineName,
    PositionNumber: 4
  });
  const getBulkExportUnitSections = () => getBulkExportUnits().map(unit => ({
    unitName: unit.UnitName,
    actions: getUnitExportActions(unit.UnitId)
  }));
  const handleExportAllUnitsPdf = async () => {
    setExportMenuAnchor(null);
    const week = formData.week || 'X';
    const reportName = sanitizeFileName(selectedDivision?.DivisionName || userData.LineName || 'Tum_Birimler');
    await generatePdf({
      actions: [],
      actionStatuses,
      userData: getBulkExportUserData(),
      weeks,
      formData,
      unitSections: getBulkExportUnitSections(),
      fileName: `Haftalik_Rapor_H${week}_${reportName}.pdf`
    });
  };
  const handleExportAllUnitsWord = async () => {
    setExportMenuAnchor(null);
    const week = formData.week || 'X';
    const reportName = sanitizeFileName(selectedDivision?.DivisionName || userData.LineName || 'Tum_Birimler');
    await generateWord({
      actions: [],
      actionStatuses,
      userData: getBulkExportUserData(),
      weeks,
      formData,
      unitSections: getBulkExportUnitSections(),
      fileName: `Haftalik_Rapor_H${week}_${reportName}.doc`
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
      
      // Apply status filter - EVP/GM always see only status-assigned actions
      const forceStatusFilter = isHighLevelView;
      if (showOnlyWithStatus || forceStatusFilter) {
        const actionStatus = actionStatuses[action.id];
        if (!actionStatus) {
          return; // Skip this action if it has no status
        }
      }

      // Non-EVP/GM: scope to own department when toggle is on
      if (!isHighLevelView && filterMyTeam && userData.DepartmentID) {
        if (action.departmentId !== userData.DepartmentID) return;
      }
      
      if (!grouped[action.week]) {
        grouped[action.week] = [];
      }
      grouped[action.week].push(action);
    });
    return grouped;
  };

  const groupedActions = groupActionsByWeek();

  const unitNameMap = {};
  divisions.forEach(d => { (d.Units || []).forEach(u => { unitNameMap[u.UnitId] = u.UnitName; }); });

  const groupActionsByUnitWeek = () => {
    const myUnitId = userData.UnitID;
    const myUnitWeeks = {};
    const otherUnitsMap = {};
    actions.filter(a => !excludedFromReport.has(a.id)).forEach(action => {
      if (formData.week && action.week !== formData.week) return;
      if ((showOnlyWithStatus || isHighLevelView) && !actionStatuses[action.id]) return;
      const uid = action.unitId || 0;
      if (uid === myUnitId) {
        if (!myUnitWeeks[action.week]) myUnitWeeks[action.week] = [];
        myUnitWeeks[action.week].push(action);
      } else {
        if (!otherUnitsMap[uid]) otherUnitsMap[uid] = {};
        if (!otherUnitsMap[uid][action.week]) otherUnitsMap[uid][action.week] = [];
        otherUnitsMap[uid][action.week].push(action);
      }
    });
    return { myUnitWeeks, otherUnitsMap };
  };

  const { myUnitWeeks, otherUnitsMap } = groupActionsByUnitWeek();

  const statusMeta = [
    { key: 'highlight',   label: 'Highlight', color: '#ef4444', bg: '#fef2f2' },
    { key: 'lowlight',    label: 'LowLight',  color: '#6b7280', bg: '#f9fafb' },
    { key: 'waiting',     label: 'Waiting',   color: '#f59e0b', bg: '#fffbeb' },
    { key: 'information', label: 'Info',      color: '#3b82f6', bg: '#eff6ff' },
    { key: 'progress',    label: 'Progress',  color: '#10b981', bg: '#ecfdf5' },
  ];

  const renderActionItem = (action, isReadOnly) => {
    const borderColor = getBorderColor(action.id);
    const isEditing = editingActionId === action.id;
    const sm = statusMeta.find(m => m.key === actionStatuses[action.id]);
    const rawItems = action.actionItems?.length ? action.actionItems : [{ type: 'text', value: action.action || '' }];
    const items = rawItems.map(a => typeof a === 'string' ? { type: 'text', value: a } : a);
    const hasSubEntries = items.length > 1;
    const main = items[0];
    const isAiGainAction = action.type === 'AI Kazanımları';
    return (
      <ListItem key={action.id} sx={{ mb: 1.25, borderRadius: 3, px: 2.5, py: 1.75, cursor: isReadOnly ? 'default' : 'pointer', background: isEditing ? 'linear-gradient(135deg,#e8f4fb,#f8fcff)' : sm ? sm.bg : isReadOnly ? '#fbfcfd' : '#ffffff', border: `1px solid ${borderColor !== 'transparent' ? borderColor + '45' : '#e8eef4'}`, borderLeft: `4px solid ${isReadOnly ? '#cbd5df' : borderColor !== 'transparent' ? borderColor : '#1464A0'}`, opacity: isReadOnly ? 0.88 : 1, '&:hover': isReadOnly ? {} : { background: isEditing ? '#e1f1fb' : sm ? sm.bg : '#f4f9fd', transform: 'translateY(-1px)', boxShadow: '0 10px 24px rgba(0,68,129,0.09)' }, transition: 'all 0.18s ease', boxShadow: isEditing ? '0 10px 28px rgba(0,68,129,0.14)' : '0 1px 6px rgba(15,23,42,0.05)' }}
        onClick={isReadOnly ? undefined : (e) => { if (window.getSelection()?.toString()) return; handleActionClick(action); }}
        onContextMenu={isReadOnly ? undefined : (e) => handleContextMenu(e, action.id)}
      >
        <ListItemText primary={
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', flex: 1 }}>
                {sm && <Chip label={sm.label} size="small" sx={{ fontWeight: 800, fontSize: '10px', flexShrink: 0, background: sm.color, color: 'white', borderRadius: '7px', height: 22, letterSpacing: 0.1 }} />}
                <Chip label={action.type} size="small" sx={{ fontWeight: 800, fontSize: '11px', flexShrink: 0, background: isReadOnly ? '#78909c' : (sm ? sm.color : '#1464A0'), color: 'white', borderRadius: '7px', height: 22, letterSpacing: 0.1 }} />
              </Box>
              <Box sx={{ flexShrink: 0, textAlign: 'right', pt: 0.1 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#546e7a', display: 'block', lineHeight: 1.4 }}>
                  {action.fullName || userData.FullName}{action.includeDate && action.date && !action.date.startsWith('1900') ? ` — ${action.date}` : ''}
                </Typography>
                {(() => { const uName = unitNameMap[action.unitId] || (action.unitId === userData.UnitID ? userData.UnitName : null); return uName ? <Typography sx={{ fontSize: '0.64rem', color: '#90a4ae', display: 'block', fontWeight: 500, lineHeight: 1.3 }}>{uName}</Typography> : null; })()}
              </Box>
            </Box>
            {isAiGainAction ? (
              <Box sx={{ mt: 1, width: '100%', overflowX: 'auto' }}>
                <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', border: '1px solid #b8d9ec', background: '#fff' }}>
                  <Box component="colgroup">
                    {[12, 40, 12, 12, 12, 12].map((width, i) => (
                      <Box component="col" key={i} sx={{ width: `${width}%` }} />
                    ))}
                  </Box>
                  <Box component="thead">
                    <Box component="tr" sx={{ background: 'linear-gradient(135deg, #e8f4fb, #f5fbff)' }}>
                      {['Proje / İnisiyatif', 'Ne Kazandık? (AI Kullanımı)', 'Kazanım Türü', 'Güncellenen Efor (a*g)', 'Efor Kazanımı', 'TTM Kazanımı'].map((h) => (
                        <Box component="th" key={h} sx={{ borderRight: '1px solid #b8d9ec', borderBottom: '1px solid #b8d9ec', px: 1, py: 0.8, color: '#004481', fontSize: '0.72rem', fontWeight: 800, textAlign: 'left', whiteSpace: 'normal' }}>{h}</Box>
                      ))}
                    </Box>
                  </Box>
                  <Box component="tbody">
                    <Box component="tr">
                      <Box component="td" sx={{ borderRight: '1px solid #d7e8f3', px: 1, py: 1, color: '#1a2d3d', fontSize: '0.78rem', lineHeight: 1.5, wordBreak: 'break-word', verticalAlign: 'top' }}>{action.project || '-'}</Box>
                      <Box component="td" sx={{ borderRight: '1px solid #d7e8f3', px: 1, py: 1, color: '#1a2d3d', fontSize: '0.78rem', lineHeight: 1.5, wordBreak: 'break-word', verticalAlign: 'top' }}>{renderBoldText(main.value)}</Box>
                      {[action.gainType, action.updatedEffort, action.effortGain, action.ttmGain].map((value, i) => (
                        <Box component="td" key={i} sx={{ borderRight: '1px solid #d7e8f3', px: 1, py: 1, color: '#1a2d3d', fontSize: '0.78rem', lineHeight: 1.5, wordBreak: 'break-word', verticalAlign: 'top' }}>{value || '-'}</Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Box>
            ) : (
              <>
                <Typography variant="body2" sx={{ fontSize: '0.93rem', color: '#1a2d3d', lineHeight: 1.75, wordWrap: 'break-word', whiteSpace: 'normal', mt: 0.25 }}>{renderBoldText(main.value)}</Typography>
                {hasSubEntries && (
                  <Box sx={{ mt: 0.75, pl: 1.5, borderLeft: '2px solid #c5dff0', ml: 0.5 }}>
                    {items.slice(1).map((item, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: i > 0 ? 0.5 : 0 }}>
                        <Box sx={{ width: 5, height: 5, borderRadius: '50%', background: '#1464A0', flexShrink: 0, mt: '7px' }} />
                        {item.type === 'image'
                          ? <Box component="img" src={item.value} alt="attachment" sx={{ maxHeight: 100, maxWidth: '100%', borderRadius: 1.5, border: '1px solid #c5dff0', mt: 0.25 }} />
                          : <Typography variant="body2" sx={{ fontSize: '0.9rem', color: '#3a4a5a', lineHeight: 1.6, wordWrap: 'break-word', whiteSpace: 'normal' }}>{renderBoldText(item.value)}</Typography>
                        }
                      </Box>
                    ))}
                  </Box>
                )}
              </>
            )}
          </Box>
        } />
      </ListItem>
    );
  };

  const renderWeekGroup = (weekGroups, isReadOnly) => {
    const statusOrder = ['highlight', 'lowlight', 'waiting', 'information', 'progress'];
    const allFiltered = Object.entries(weekGroups).flatMap(([, weekActions]) =>
      (activeCounterFilter ? weekActions.filter(a => actionStatuses[a.id] === activeCounterFilter) : weekActions)
        .slice().sort((a, b) => {
          const ai = statusOrder.indexOf(actionStatuses[a.id] || '');
          const bi = statusOrder.indexOf(actionStatuses[b.id] || '');
          return (ai === -1 ? statusOrder.length : ai) - (bi === -1 ? statusOrder.length : bi);
        })
    );
    return allFiltered.map(action => renderActionItem(action, isReadOnly));
  };

  const countWeekGroupActions = (weekGroups) =>
    Object.values(weekGroups).flat().length;

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
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden', background: 'radial-gradient(circle at 20% 0%, rgba(45,204,205,0.16), transparent 28%), linear-gradient(160deg, #eef8fc 0%, #f8fcff 52%, #eaf6fb 100%)' }}>

      {/* ── HEADER (full width) ── */}
      <Box
        sx={{
          px: { xs: 2, sm: 3, md: 5 },
          py: { xs: '14px', md: '22px' },
          background: 'linear-gradient(135deg, #003b73 0%, #005a9c 58%, #1464A0 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 14px 36px rgba(0,68,129,0.28)',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
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
            <Typography sx={{ opacity: 0.9, mt: 0.5, lineHeight: 1.4, fontWeight: 700, fontSize: { xs: '0.85rem', md: '1rem' }, letterSpacing: 0.5 }}>
              {userData.LineName}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ textAlign: 'right', zIndex: 1 }}>
          <Box sx={{ background: 'rgba(255,255,255,0.18)', borderRadius: 3, px: 3, py: 1.5, backdropFilter: 'blur(8px)' }}>
            <Typography variant="caption" sx={{ opacity: 0.85, display: 'block' }}>
              {isHighLevelView ? 'Statülü Aksiyon' : 'Toplam Aksiyon'}
            </Typography>
            <Typography variant="h4" fontWeight={800}>
              {isHighLevelView
                ? actions.filter(a => !!actionStatuses[a.id]).length
                : actions.length}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Container maxWidth="xl" sx={{ py: 3, px: { xs: 2, sm: 3, md: 4 }, flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ── TWO PANES ── */}
        <Grid container spacing={2.5} sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'flex-start', flex: 1, minHeight: 0 }}>

          {/* LEFT PANE — hidden for EVP/GM */}
          {!isHighLevelView && <Grid item sx={{
            flex: { xs: '0 0 100%', md: leftPanelOpen ? '0 0 31%' : '0 0 0%' },
            maxWidth: { xs: '100%', md: leftPanelOpen ? '31%' : '0%' },
            width: '100%', display: 'flex',
            overflow: 'hidden',
            transition: 'flex 0.3s ease, max-width 0.3s ease',
          }}>
            <Card
              elevation={0}
              sx={{
                height: 'auto',
                width: '100%',
                borderRadius: 0,
                border: '1px solid',
                borderColor: editingActionId ? '#2DCCCD' : '#c5dff0',
                boxShadow: editingActionId
                  ? '0 18px 42px rgba(45,204,205,0.18)'
                  : '0 18px 42px rgba(0,68,129,0.10)',
                transition: 'box-shadow 0.3s, border-color 0.3s',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box
                sx={{
                  background: isHighLevelView
                    ? 'linear-gradient(90deg, #004481, #6b7280)'
                    : editingActionId
                      ? 'linear-gradient(90deg, #1464A0, #2DCCCD)'
                      : 'linear-gradient(90deg, #004481, #1464A0)',
                  borderRadius: 0,
                  px: 2.5, py: 1.55,
                  minHeight: 52,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <Typography variant="h6" fontWeight={800} color="white" sx={{ fontSize: '0.96rem', letterSpacing: 0.15 }}>
                  {isHighLevelView ? 'Filtrele' : editingActionId ? 'Aksiyonu Güncelle' : 'Yeni Aksiyon Ekle'}
                </Typography>
                <Tooltip title="Paneli Gizle">
                  <IconButton size="small" onClick={() => setLeftPanelOpen(false)} sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: 'white', background: 'rgba(255,255,255,0.15)' } }}>
                    <ChevronLeft />
                  </IconButton>
                </Tooltip>
              </Box>

              <CardContent sx={{ px: 3, pt: 2.5, pb: 2.5, display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)', '&:last-child': { pb: 2.5 } }}>
                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  <FormControl fullWidth margin="normal" error={errors.week}>
                    <InputLabel>Hafta</InputLabel>
                    <Select
                      name="week"
                      value={formData.week}
                      onChange={handleInputChange}
                      label="Hafta"
                      sx={{ borderRadius: 2.5, background: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d7e3ec' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1464A0', borderWidth: 2 } }}
                    >
                      <MenuItem value=""><em>Hafta seçin...</em></MenuItem>
                      {weeks.map((week, index) => (
                        <MenuItem key={index} value={String(week.WeekNumber)}>{week.Year}/{week.WeekNumber}. Hafta</MenuItem>
                      ))}
                    </Select>
                    {errors.week && <FormHelperText>Lütfen hafta seçin</FormHelperText>}
                  </FormControl>

                  {!isHighLevelView && (<>
                  <FormControl fullWidth margin="normal" error={errors.type}>
                    <InputLabel>Tür</InputLabel>
                    <Select
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      label="Tür"
                      sx={{ borderRadius: 2.5, background: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d7e3ec' } }}
                    >
                      <MenuItem value=""><em>Tür seçin...</em></MenuItem>
                      {types.map((type, index) => (
                        <MenuItem key={index} value={type.TypeName}>{type.TypeName}</MenuItem>
                      ))}
                    </Select>
                    {errors.type && <FormHelperText>Lütfen tür seçin</FormHelperText>}
                  </FormControl>

                  {!!types.find(t => t.TypeName === formData.type)?.IncludeDate && (
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

                  {formData.type === 'AI Kazanımları' && (
                    <Box sx={{ mt: 1 }}>
                      <TextField
                        fullWidth margin="dense" name="project" label="Proje"
                        value={formData.project} onChange={handleInputChange}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                      <FormControl fullWidth margin="dense">
                        <InputLabel>Kazanım Türü</InputLabel>
                        <Select
                          name="gainType"
                          label="Kazanım Türü"
                          value={formData.gainType}
                          onChange={handleInputChange}
                          sx={{ borderRadius: 2, background: '#fff' }}
                        >
                          <MenuItem value=""><em>Seçin...</em></MenuItem>
                          {gainTypes.map((gt, i) => (
                            <MenuItem key={i} value={gt}>{gt}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        fullWidth margin="dense" name="updatedEffort" label="Güncellenen Efor"
                        value={formData.updatedEffort} onChange={handleInputChange}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                      <TextField
                        fullWidth margin="dense" name="effortGain" label="Efor Kazanımı"
                        value={formData.effortGain} onChange={handleInputChange}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                      <TextField
                        fullWidth margin="dense" name="ttmGain" label="TTM Kazanımı"
                        value={formData.ttmGain} onChange={handleInputChange}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Box>
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
                          minHeight: 140,
                          border: errors.action ? '1px solid #d32f2f' : '1px solid #d7e3ec',
                          borderRadius: 2.5,
                          px: '16px', py: '14px',
                          outline: 'none',
                          fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
                          fontSize: '0.86rem',
                          lineHeight: 1.75,
                          color: '#172b3a',
                          background: '#fff',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          overflowY: 'auto',
                          cursor: 'text',
                          boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.03)',
                          '&:focus': { borderColor: errors.action ? '#d32f2f' : '#1464A0', borderWidth: '2px', px: '15px', py: '13px', boxShadow: '0 0 0 4px rgba(20,100,160,0.08)' },
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
                              onPaste={(e) => {
                                e.preventDefault();
                                const text = e.clipboardData.getData('text/plain');
                                const sel = window.getSelection();
                                if (!sel || !sel.rangeCount) return;
                                const r = sel.getRangeAt(0);
                                r.deleteContents();
                                const node = document.createTextNode(text);
                                r.insertNode(node);
                                r.setStartAfter(node); r.collapse(true);
                                sel.removeAllRanges(); sel.addRange(r);
                                handleActionItemChange(index, htmlToMarkers(e.currentTarget.innerHTML));
                              }}
                              sx={{
                                flex: 1,
                                minHeight: 52,
                                border: '1px solid rgba(0,0,0,0.23)',
                                borderRadius: 2,
                                px: '12px', py: '9px',
                                outline: 'none',
                                fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
                                fontSize: '0.75rem',
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

                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      type="submit" variant="contained"
                      startIcon={<Save sx={{ fontSize: '16px !important' }} />}
                      sx={{
                        flex: 1, py: 0.9, borderRadius: 2, fontWeight: 700, fontSize: '13px',
                        background: editingActionId
                          ? 'linear-gradient(135deg, #1464A0, #2DCCCD)'
                          : 'linear-gradient(135deg, #004481, #1464A0)',
                        boxShadow: '0 3px 10px rgba(0,68,129,0.35)',
                        '&:hover': { boxShadow: '0 5px 16px rgba(0,68,129,0.5)', transform: 'translateY(-1px)' },
                        transition: 'all 0.2s',
                      }}
                    >
                      {editingActionId ? 'Güncelle' : 'Kaydet'}
                    </Button>
                    {editingActionId && (
                      <Button
                        variant="outlined" onClick={handleCancelEdit}
                        sx={{ flex: 1, py: 0.9, borderRadius: 2, fontWeight: 600, fontSize: '13px', borderColor: '#1464A0', color: '#1464A0', '&:hover': { background: '#e8f4fb' } }}
                      >
                        İptal
                      </Button>
                    )}
                  </Box>
                  </>)}
                </Box>
              </CardContent>
            </Card>
          </Grid>}

          {/* RIGHT PANE */}
          <Grid item sx={{ flex: { xs: '0 0 100%', md: (isHighLevelView || !leftPanelOpen) ? '0 0 100%' : '0 0 69%' }, maxWidth: { xs: '100%', md: (isHighLevelView || !leftPanelOpen) ? '100%' : '69%' }, width: '100%', display: 'flex', flexDirection: 'column', transition: 'flex 0.3s ease, max-width 0.3s ease', position: 'relative', pr: { md: '38px' } }}>

            {/* Re-open panel tab — only for non-EVP/GM */}
            {!leftPanelOpen && !isHighLevelView && (
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
                  : 'translateY(-50%) translateX(calc(100% - 30px))',
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
                  width: 30, height: 80, cursor: 'pointer',
                  background: 'linear-gradient(180deg, #004481, #1464A0)',
                  borderRadius: '8px 0 0 8px',
                  boxShadow: '-3px 0 12px rgba(0,68,129,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s, box-shadow 0.2s',
                  animation: statusPanelOpen ? 'none' : 'pulseTab 2.5s ease-in-out infinite',
                  '@keyframes pulseTab': {
                    '0%':   { boxShadow: '-3px 0 12px rgba(0,68,129,0.4)' },
                    '50%':  { boxShadow: '-3px 0 22px rgba(0,68,129,0.85)' },
                    '100%': { boxShadow: '-3px 0 12px rgba(0,68,129,0.4)' },
                  },
                  '&:hover': { background: 'linear-gradient(180deg, #1565C0, #2196F3)', boxShadow: '-3px 0 18px rgba(0,68,129,0.6)' },
                }}
              >
                {statusPanelOpen
                  ? <ChevronRight sx={{ fontSize: 15, color: 'rgba(255,255,255,0.9)' }} />
                  : <ChevronLeft  sx={{ fontSize: 15, color: 'rgba(255,255,255,0.9)' }} />
                }
              </Box>

              {/* Panel body */}
              <Box sx={{
                ml: '30px',
                background: 'white',
                borderRadius: '12px 0 0 12px',
                boxShadow: '-4px 0 24px rgba(0,68,129,0.18)',
                border: '1px solid #c5dff0',
                borderRight: 'none',
                overflow: 'hidden',
                minWidth: 240,
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
                <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
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

                  <FormControl size="small" fullWidth>
                    <InputLabel sx={{ fontSize: '11px' }}>Bölüm</InputLabel>
                    <Select
                      value={selectedLineId || ''}
                      onChange={(e) => handleLineChange(e.target.value || null)}
                      label="Bölüm"
                      sx={{ fontSize: '11px', borderRadius: 1.5 }}
                    >
                      <MenuItem value=""><em style={{ fontSize: '11px' }}>Tüm Bölümler</em></MenuItem>
                      {divisions.map(d => (
                        <MenuItem key={d.DivisionId} value={d.DivisionId} sx={{ fontSize: '11px' }}>{d.DivisionName}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {!isHighLevelView && selectedDivisionContainsMyUnit && (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={showOnlyMyUnit}
                          onChange={(e) => setShowOnlyMyUnit(e.target.checked)}
                          size="small"
                          sx={{ color: '#1464A0', '&.Mui-checked': { color: '#004481' }, py: 0.25 }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: '11px', fontWeight: showOnlyMyUnit ? 700 : 400, color: showOnlyMyUnit ? '#004481' : '#546e7a' }}>Kendi Birimim</Typography>
                      }
                      sx={{ mx: 0, mt: 0.5 }}
                    />
                  )}
                </Box>

                <Divider sx={{ mx: 1.5, borderColor: '#e8f4fb' }} />

                {/* Counters — vertical */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1 }}>
                  {/* Toplam — hidden for EVP/GM */}
                  {!(isHighLevelView) && (
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

            {/* Ekip Aksiyonları — own unit card, only when selected division contains user's unit */}
            {selectedDivisionContainsMyUnit && <Card elevation={0} className="print-section" sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 0, border: '1px solid rgba(174,214,241,0.85)', boxShadow: '0 18px 44px rgba(0,68,129,0.10)', overflow: 'hidden', background: '#fff' }}>
              <Box sx={{ background: 'linear-gradient(135deg, #004481 0%, #075c98 58%, #1464A0 100%)', px: 2.5, py: 1.35, minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                  <Typography variant="h6" fontWeight={800} color="white" sx={{ fontSize: '0.9rem', letterSpacing: 0.2, lineHeight: 1.2 }}>{userData.UnitName || 'Ekip Aksiyonları'}</Typography>
                  {countWeekGroupActions(myUnitWeeks) > 0 && <Chip label={`${countWeekGroupActions(myUnitWeeks)} aksiyon`} size="small" sx={{ fontWeight: 800, fontSize: '10px', height: 21, background: 'rgba(255,255,255,0.16)', color: 'white', border: '1px solid rgba(255,255,255,0.22)', '& .MuiChip-label': { px: 1 } }} />}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  {!(isHighLevelView) && (
                    <>
                      <Tooltip title="Filtre">
                        <IconButton
                          size="small"
                          onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
                          sx={{
                            width: 30,
                            height: 30,
                            color: (showOnlyWithStatus || filterMyTeam) ? '#004481' : 'white',
                            background: (showOnlyWithStatus || filterMyTeam) ? 'white' : 'rgba(255,255,255,0.15)',
                            border: '1px solid rgba(255,255,255,0.6)',
                            borderRadius: 2, px: 1,
                            '&:hover': { background: (showOnlyWithStatus || filterMyTeam) ? '#f5f3ff' : 'rgba(255,255,255,0.25)' }
                          }}
                        >
                          <FilterList fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Menu
                        anchorEl={filterMenuAnchor}
                        open={Boolean(filterMenuAnchor)}
                        onClose={() => setFilterMenuAnchor(null)}
                        PaperProps={{ sx: { mt: 1, minWidth: 210, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' } }}
                      >
                        <MenuItem
                          onClick={() => { setShowOnlyWithStatus(prev => !prev); setFilterMenuAnchor(null); }}
                          sx={{ fontSize: '0.82rem', gap: 1.5, fontWeight: showOnlyWithStatus ? 700 : 400 }}
                        >
                          <Flag fontSize="small" sx={{ color: showOnlyWithStatus ? '#004481' : '#9e9e9e' }} />
                          Rapora Eklenenler
                          {showOnlyWithStatus && <Done fontSize="small" sx={{ ml: 'auto', color: '#004481' }} />}
                        </MenuItem>
                        {!isHighLevelView && (
                          <MenuItem
                            onClick={() => { setFilterMyTeam(prev => !prev); setFilterMenuAnchor(null); }}
                            sx={{ fontSize: '0.82rem', gap: 1.5, fontWeight: filterMyTeam ? 700 : 400 }}
                          >
                            <People fontSize="small" sx={{ color: filterMyTeam ? '#004481' : '#9e9e9e' }} />
                            Kendi Ekibim
                            {filterMyTeam && <Done fontSize="small" sx={{ ml: 'auto', color: '#004481' }} />}
                          </MenuItem>
                        )}
                      </Menu>
                    </>
                  )}
                  <Tooltip title="Dışa Aktar">
                    <IconButton
                      size="small"
                      className="no-print"
                      onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                      sx={{ width: 30, height: 30, color: 'white', border: '1px solid rgba(255,255,255,0.45)', borderRadius: 2, px: 1, background: 'rgba(255,255,255,0.08)', '&:hover': { background: 'rgba(255,255,255,0.2)' } }}
                    >
                      <MoreHoriz fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={exportMenuAnchor}
                    open={Boolean(exportMenuAnchor)}
                    onClose={() => setExportMenuAnchor(null)}
                    PaperProps={{ sx: { mt: 1, minWidth: 180, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' } }}
                  >
                    <MenuItem onClick={handleExportPdf} sx={{ fontSize: '0.75rem', gap: 1.5 }}>
                      <PictureAsPdf fontSize="small" sx={{ color: '#c62828' }} /> PDF'e Çevir
                    </MenuItem>
                    <MenuItem onClick={handleExportWord} sx={{ fontSize: '0.75rem', gap: 1.5 }}>
                      <WordIcon fontSize="small" sx={{ color: '#1565c0' }} /> Word'e Çevir
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={handleExportAllUnitsPdf} sx={{ fontSize: '0.75rem', gap: 1.5 }}>
                      <PictureAsPdf fontSize="small" sx={{ color: '#c62828' }} /> Tüm Birimler PDF
                    </MenuItem>
                    <MenuItem onClick={handleExportAllUnitsWord} sx={{ fontSize: '0.75rem', gap: 1.5 }}>
                      <WordIcon fontSize="small" sx={{ color: '#1565c0' }} /> Tüm Birimler Word
                    </MenuItem>
                  </Menu>
                </Box>
              </Box>

              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 2, pt: 2, pb: 2.25, background: 'linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)', '&:last-child': { pb: 2.25 } }}>
                {Object.keys(myUnitWeeks).length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 7, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #cce4f5, #e8f4fb)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                      <Article sx={{ fontSize: 36, color: '#1464A0' }} />
                    </Box>
                    <Typography variant="h6" color="text.secondary" fontWeight={600}>Henüz kayıt yok</Typography>
                    <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>Yeni bir aksiyon ekleyerek başlayın</Typography>
                  </Box>
                ) : (
                  <List disablePadding>{renderWeekGroup(myUnitWeeks, false)}</List>
                )}
              </CardContent>
            </Card>}

            {/* Other unit cards — read-only, units from selected division */}
            {(isHighLevelView || !showOnlyMyUnit || !selectedDivisionContainsMyUnit) &&
              (selectedDivision?.Units || []).filter(u => u.UnitId !== userData.UnitID)
              .map(u => {
                const weekGroups = otherUnitsMap[u.UnitId] || {};
                const total = Object.values(weekGroups).flat().length;
                return (
                  <Card key={u.UnitId} elevation={0} sx={{ mt: 2, borderRadius: 0, border: '1px solid #d9e2e8', boxShadow: '0 12px 32px rgba(15,23,42,0.07)', overflow: 'hidden', background: '#fff' }}>
                    <Box sx={{ background: 'linear-gradient(135deg,#526f7b,#78909c)', px: 2.5, py: 1.35, minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                        <Typography variant="h6" fontWeight={800} color="white" sx={{ fontSize: '0.9rem', letterSpacing: 0.2, lineHeight: 1.2 }}>{u.UnitName}</Typography>
                        {total > 0 && <Chip label={`${total} aksiyon`} size="small" sx={{ fontWeight: 800, fontSize: '10px', height: 21, background: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.22)', '& .MuiChip-label': { px: 1 } }} />}
                      </Box>
                      <Chip label="Salt Okunur" size="small" sx={{ fontWeight: 700, fontSize: '10px', height: 22, background: 'rgba(255,255,255,0.14)', color: 'white', border: '1px solid rgba(255,255,255,0.34)', '& .MuiChip-label': { px: 1 } }} />
                    </Box>
                    <CardContent sx={{ px: 2, pt: 2, pb: 2.25, background: 'linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)', '&:last-child': { pb: 2.25 } }}>
                      {total === 0
                        ? <Typography variant="body2" color="text.disabled" sx={{ py: 3, textAlign: 'center', fontStyle: 'italic' }}>Bu hafta aksiyon yok</Typography>
                        : <List disablePadding>{renderWeekGroup(weekGroups, true)}</List>
                      }
                    </CardContent>
                  </Card>
                );
              })
            }
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
