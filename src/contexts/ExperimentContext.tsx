"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getActiveExperiment } from "@/config/experiments";
import Cookies from "js-cookie";

interface ExperimentValue {
  experimentName: string | null;
  variant: string | null;
}

const ExperimentContext = createContext<ExperimentValue>({
  experimentName: null,
  variant: null,
});

export function ExperimentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ExperimentValue>({
    experimentName: null,
    variant: null,
  });

  useEffect(() => {
    const exp = getActiveExperiment();
    if (!exp) return;
    const variant = Cookies.get(`ab_${exp.name}`) || null;
    setState({ experimentName: exp.name, variant });
  }, []);

  return (
    <ExperimentContext.Provider value={state}>
      {children}
    </ExperimentContext.Provider>
  );
}

export function useExperiment() {
  return useContext(ExperimentContext);
}
