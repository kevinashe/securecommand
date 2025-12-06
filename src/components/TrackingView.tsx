import React from 'react';
import { LiveTrackingMap } from './LiveTrackingMap';

interface TrackingViewProps {
  onBack?: () => void;
}

export const TrackingView: React.FC<TrackingViewProps> = ({ onBack }) => {
  return <LiveTrackingMap onBack={onBack} />;
};
