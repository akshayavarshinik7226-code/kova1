import type { ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { PublicLayout } from './components/PublicLayout';
import { Spinner, ToastViewport } from './components/ui';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { Contact } from './pages/public/Contact';
import { Docs } from './pages/public/Docs';
import { Faq } from './pages/public/Faq';
import { Features } from './pages/public/Features';
import { HowItWorks } from './pages/public/HowItWorks';
import { Landing } from './pages/public/Landing';
import { Login } from './pages/public/Login';
import { Register } from './pages/public/Register';
import { StudentOverview } from './pages/app/Overview';
import { StudentProjects } from './pages/app/Projects';
import { ProjectDetail } from './pages/app/ProjectDetail';
import { ProjectSettings } from './pages/app/ProjectSettings';
import { Deployments } from './pages/app/Deployments';
import { NewDeployment } from './pages/app/NewDeployment';
import { DeploymentDetailPage } from './pages/app/DeploymentDetailPage';
import { BuildLogsPage } from './pages/app/BuildLogsPage';
import { NotificationsPage } from './pages/app/NotificationsPage';
import { ProfilePage } from './pages/app/ProfilePage';
import { StudentDocs } from './pages/app/StudentDocs';
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminStudents } from './pages/admin/AdminStudents';
import { AdminProjects } from './pages/admin/AdminProjects';
import { AdminDeployments } from './pages/admin/AdminDeployments';
import { AdminQueue } from './pages/admin/AdminQueue';
import { AdminFailed } from './pages/admin/AdminFailed';
import { AdminActivity } from './pages/admin/AdminActivity';
import { AdminUsage } from './pages/admin/AdminUsage';
import { AdminSystem } from './pages/admin/AdminSystem';
import { AdminMessages } from './pages/admin/AdminMessages';

function Toaster() {
  const { toasts, dismiss } = useToast();
  return <ToastViewport toasts={toasts} onDismiss={dismiss} />;
}

function Guard({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="center" style={{ minHeight: '60vh' }}>
        <Spinner large />
        <p className="text-muted text-sm" style={{ marginTop: 12 }}>
          Checking your session…
        </p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="center stack gap-3" style={{ minHeight: '60vh', textAlign: 'center' }}>
      <p className="eyebrow">404</p>
      <h1 style={{ fontSize: '1.6rem' }}>This page does not exist</h1>
      <p className="text-muted text-sm">The route may have moved, or the link is out of date.</p>
      <div className="row gap-2">
        <Link className="btn btn-primary btn-sm" to="/">
          Back to home
        </Link>
        <Link className="btn btn-secondary btn-sm" to="/app">
          Open workspace
        </Link>
      </div>
    </div>
  );
}

function PublicPage({ children }: { children: ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Toaster />
            <Routes>
              {/* Public */}
              <Route path="/" element={<PublicPage><Landing /></PublicPage>} />
              <Route path="/features" element={<PublicPage><Features /></PublicPage>} />
              <Route path="/how-it-works" element={<PublicPage><HowItWorks /></PublicPage>} />
              <Route path="/docs" element={<PublicPage><Docs /></PublicPage>} />
              <Route path="/faq" element={<PublicPage><Faq /></PublicPage>} />
              <Route path="/contact" element={<PublicPage><Contact /></PublicPage>} />
              <Route path="/login" element={<PublicPage><Login /></PublicPage>} />
              <Route path="/register" element={<PublicPage><Register /></PublicPage>} />

              {/* Student workspace */}
              <Route path="/app" element={<Guard><AppLayout /></Guard>}>
                <Route index element={<StudentOverview />} />
                <Route path="projects" element={<StudentProjects />} />
                <Route path="projects/:id" element={<ProjectDetail />} />
                <Route path="projects/:id/settings" element={<ProjectSettings />} />
                <Route path="deployments" element={<Deployments />} />
                <Route path="deployments/new" element={<NewDeployment />} />
                <Route path="deployments/:id" element={<DeploymentDetailPage />} />
                <Route path="deployments/:id/logs" element={<BuildLogsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="docs" element={<StudentDocs />} />
              </Route>

              {/* Admin */}
              <Route path="/admin" element={<Guard admin><AppLayout /></Guard>}>
                <Route index element={<AdminOverview />} />
                <Route path="students" element={<AdminStudents />} />
                <Route path="projects" element={<AdminProjects />} />
                <Route path="deployments" element={<AdminDeployments />} />
                <Route path="queue" element={<AdminQueue />} />
                <Route path="failed" element={<AdminFailed />} />
                <Route path="activity" element={<AdminActivity />} />
                <Route path="usage" element={<AdminUsage />} />
                <Route path="system" element={<AdminSystem />} />
                <Route path="messages" element={<AdminMessages />} />
              </Route>

              <Route path="*" element={<PublicPage><NotFound /></PublicPage>} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
