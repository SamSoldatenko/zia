'use client';

import { Info } from 'lucide-react';
import InfoCard from '../ui/InfoCard';

export default function AboutPage(): React.ReactElement {
  return (
    <InfoCard icon={<Info size={48} className="text-gray-400" />} title="About ZIA">
      <p className="text-gray-600 dark:text-gray-400">
        ZIA is a personal AI assistant for storing and analyzing personal data.
      </p>
    </InfoCard>
  );
}
