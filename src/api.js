const BASE = (window.APP_CONFIG && window.APP_CONFIG.apiUrl) || 'http://localhost:4443';

const json = async (url, init) => {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = new Error(res.statusText);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
};

const post = (url, body) => json(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const put = (url, body) => json(url, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const patch = (url, body) => json(url, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

// Returns raw Response so caller can inspect status codes (404 vs other errors)
export const getUser = (windowName) =>
  fetch(`${BASE}/api/users/windowname/${encodeURIComponent(windowName)}`);

export const getWeeks = (year) =>
  json(`${BASE}/api/weeks?year=${year}`);

export const getLines = () =>
  json(`${BASE}/api/lines`);

export const getActionStatuses = () =>
  json(`${BASE}/api/action-statuses`);

export const getActionTypes = () =>
  json(`${BASE}/api/action-types`);

export const getActions = (weekNumber, year, lineId = null) =>
  json(`${BASE}/api/actions?weekNumber=${weekNumber}&year=${year}${lineId ? `&lineId=${lineId}` : ''}`);

export const getActionItems = (actionId) =>
  json(`${BASE}/api/actions/${actionId}/items`);

export const createAction = (data) =>
  post(`${BASE}/api/actions`, data);

export const updateAction = (id, data) =>
  put(`${BASE}/api/actions/${id}`, data);

export const patchActionStatus = (id, data) =>
  patch(`${BASE}/api/actions/${id}/status`, data);

export const deleteAction = (id) =>
  json(`${BASE}/api/actions/${id}`, { method: 'DELETE' });
