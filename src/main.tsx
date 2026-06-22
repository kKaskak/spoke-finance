import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '@/lib/app';
import { ToastProvider } from '@/lib/toast';
import { WalletProvider } from '@/lib/wallet';
import { App } from './App';
import './styles/global.scss';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <WalletProvider>
                <ToastProvider>
                    <AppProvider>
                        <App />
                    </AppProvider>
                </ToastProvider>
            </WalletProvider>
        </BrowserRouter>
    </StrictMode>
);
