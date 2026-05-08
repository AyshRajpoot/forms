import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useAuth } from "./context/AuthContext";
import { AdminFormCreatePage } from "./pages/AdminFormCreatePage";
import { AdminFormDetailPage } from "./pages/AdminFormDetailPage";
import { AdminFormViewPage } from "./pages/AdminFormViewPage";
import { AdminFormsPage } from "./pages/AdminFormsPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { PublicFormPage } from "./pages/PublicFormPage";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <AppShell>
            <HomePage />
          </AppShell>
        }
      />
      <Route
        path="/f/:formKey"
        element={
          <AppShell>
            <PublicFormPage />
          </AppShell>
        }
      />
      <Route
        path="/admin/forms"
        element={
          <ProtectedRoute>
            <AppShell>
              <AdminFormsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/forms/new"
        element={
          <ProtectedRoute>
            <AppShell>
              <AdminFormCreatePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/forms/:formId"
        element={
          <ProtectedRoute>
            <AppShell>
              <AdminFormDetailPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/forms/:formId/view"
        element={
          <ProtectedRoute>
            <AppShell>
              <AdminFormViewPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
