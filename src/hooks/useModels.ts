import { useEffect, useState, useCallback } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { ModelList } from "../types";

export function useModels(translationUrl: string) {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem("selectedModel") || ""
  );

  useEffect(() => {
    localStorage.setItem("selectedModel", selectedModel);
  }, [selectedModel]);

  const fetchModels = useCallback(async () => {
    if (!translationUrl.trim()) {
      alert("Please enter a Translation Server URL.");
      return;
    }
    try {
      const endpoint = `${translationUrl.replace(/\/$/, "")}/v1/models`;
      const data: ModelList = await invoke("fetch_models", {
        apiUrl: endpoint,
      });
      const ids = data.data.map((m) => m.id);
      setModels(ids);
      if (!selectedModel || !ids.includes(selectedModel)) {
        setSelectedModel(ids[0] || "");
      }
    } catch (e) {
      console.error("Error fetching models:", e);
      alert("Failed to fetch models. Check URL and server status.");
      setModels([]);
      setSelectedModel("");
    }
  }, [translationUrl, selectedModel]);

  useEffect(() => {
    if (translationUrl) {
      fetchModels();
    }
  }, []);

  return { models, selectedModel, setSelectedModel, fetchModels };
}
