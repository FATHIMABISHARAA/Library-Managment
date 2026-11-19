
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Automatically attach the logged-in user's token.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')

  if (token) {
    config.headers.Authorization = `Token ${token}`
  }

  return config
})

// Authentication APIs
export const registerMember = (data) =>
  api.post('/auth/register/', data)

export const loginUser = (data) =>
  api.post('/auth/login/', data)

export const logoutUser = () =>
  api.post('/auth/logout/')

// Book APIs
export const getBooks = () => api.get('/books/')
export const createBook = (data) => api.post('/books/', data)
export const updateBook = (id, data) => api.put(`/books/${id}/`, data)
export const deleteBook = (id) => api.delete(`/books/${id}/`)

// Member APIs
export const getMembers = () => api.get('/members/')
export const createMember = (data) => api.post('/members/', data)
export const updateMember = (id, data) => api.put(`/members/${id}/`, data)
export const deleteMember = (id) => api.delete(`/members/${id}/`)

// Loan APIs
export const getLoans = () => api.get('/loans/')
export const getMyLoans = () => api.get('/loans/my_loans/')
export const getOverdue = () => api.get('/loans/overdue/')
export const issueBook = (data) => api.post('/loans/issue/', data)
export const returnBook = (id) =>
  api.post(`/loans/${id}/return_book/`)

// Fine APIs
export const getMyFines = () => api.get('/loans/my_fines/')
export const payFine = (data) => api.post('/loans/pay_fine/', data)

export default api
