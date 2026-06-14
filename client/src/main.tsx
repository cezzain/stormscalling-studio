import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthGate } from './AuthGate';
import { applyAppearance, loadAppearance } from './lib/appearance';
import './index.css';

// Apply saved look & feel before first paint so there's no flash.
applyAppearance(loadAppearance());

ReactDOM.createRoot(document.getElementById('root')!).render(<AuthGate />);
