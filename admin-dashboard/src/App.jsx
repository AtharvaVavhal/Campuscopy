import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './pages/LoginPage';
import JobQueuePage from './pages/JobQueuePage';
import AnalyticsPage from './pages/AnalyticsPage';
import PrintersPage from './pages/PrintersPage';
import Layout from './components/Layout';

const queryClient = new QueryClient();

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/jobs" replace />} />
            <Route path="jobs" element={<JobQueuePage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="printers" element={<PrintersPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
