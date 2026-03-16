import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Applied is now a tab on the Saved/Tracker page
export default function AppliedPage() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/saved?tab=applied', { replace: true }); }, [navigate]);
  return null;
}
