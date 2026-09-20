import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell/AppShell';
import { Dashboard } from '@/routes/Dashboard/Dashboard';
import { Markets } from '@/routes/Markets/Markets';
import { Tracker } from '@/routes/Tracker/Tracker';

export const App = () => (
    <Routes>
        <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="markets" element={<Markets />} />
            <Route path="tracker/:address?" element={<Tracker />} />
        </Route>
    </Routes>
);
