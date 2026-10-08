import { Link } from 'react-router';
import { AdminPage } from '../components/AdminPage';

export function AdminNotFoundPage() {
  return (
    <AdminPage title="Page not found">
      <p>
        This admin page does not exist. <Link to="/admin">Go to the dashboard</Link>
      </p>
    </AdminPage>
  );
}
