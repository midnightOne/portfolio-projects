"use client";

import React, { Suspense, ReactNode } from 'react';
import { ReflinkSessionProvider } from './reflink-session-provider';

interface ReflinkSessionWrapperProps {
  children: ReactNode;
}

function ReflinkSessionProviderWithSuspense({ children }: ReflinkSessionWrapperProps) {
  return (
    <Suspense fallback={<div>Loading AI session...</div>}>
      <ReflinkSessionProvider>
        {children}
      </ReflinkSessionProvider>
    </Suspense>
  );
}

export { ReflinkSessionProviderWithSuspense as ReflinkSessionProvider };