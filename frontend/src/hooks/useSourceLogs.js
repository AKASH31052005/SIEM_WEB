import { useEffect, useMemo, useState } from "react";
import API from "../api";

const DEFAULT_LIMIT = 1500;

function toKey(log) {
  return (
    log._id ||
    [
      log.logType || log.source || "unknown",
      log.timestamp || log.createdAt || "",
      log.eventId || log.EventID || "",
      log.message || log.Message || "",
      log.sourceIP || log.srcIP || log.ip || "",
      log.destIP || log.dst_ip || "",
      log.method || log.operation || "",
      log.url || log.endpoint || "",
    ].join("|")
  );
}

function inferSource(log) {
  const explicit = String(log.source || log.logType || log.LogType || "").toLowerCase();
  if (["system", "windows", "linux", "web", "network", "application", "database"].includes(explicit)) {
    return explicit;
  }

  if (explicit.includes("window")) return "windows";
  if (explicit.includes("linux")) return "linux";
  if (explicit.includes("network") || explicit.includes("netflow")) return "network";
  if (
    explicit.includes("web") ||
    explicit.includes("http") ||
    explicit.includes("nginx") ||
    explicit.includes("apache") ||
    explicit.includes("iis")
  ) {
    return "web";
  }
  if (explicit.includes("database") || explicit.includes("mongo") || explicit.includes("sql")) return "database";
  if (explicit.includes("application")) return "application";

  if (log.EventID !== undefined || log.eventId !== undefined || log.TimeCreated || log.MachineName) return "windows";
  if (log.Host || log.Process || log.Timestamp) return "linux";
  if (log.srcIP !== undefined || log.destIP !== undefined || log.destPort !== undefined) return "network";
  if (log.Method || log.URL || log.StatusCode || log.userAgent || log.path) return "web";
  if (log.operationType || log.collection || log.collectionName || log.event_category === "database") return "database";
  if (log.event_category || log.event_action || log.status_code || log.endpoint) return "application";

  return "system";
}

function matchesSource(log, sourceType) {
  return inferSource(log) === sourceType;
}

export default function useSourceLogs({
  sourceType,
  timeRange = "all",
  liveLogs = [],
  limit = DEFAULT_LIMIT,
  pollIntervalMs = 15000,
}) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;
    let isFetching = false;
    let hasLoadedInitially = false;

    async function fetchSource() {
      if (isFetching) return;
      isFetching = true;
      if (!hasLoadedInitially) {
        setLoading(true);
      }
      try {
        const params = new URLSearchParams({
          timeRange,
          limit: String(limit),
        });
        const res = await API.get(`/api/logs/source/${sourceType}?${params.toString()}`);

        if (cancelled) return;
        const data = res.data || {};
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setTotal(Number.isFinite(data.total) ? data.total : (data.logs || []).length);
      } catch (err) {
        if (!cancelled) {
          setLogs([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          hasLoadedInitially = true;
        }
        isFetching = false;
      }
    }

    fetchSource();
    if (pollIntervalMs > 0) {
      intervalId = setInterval(fetchSource, pollIntervalMs);
    }

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [sourceType, timeRange, limit, pollIntervalMs]);

  useEffect(() => {
    if (!liveLogs.length) return;

    const incoming = liveLogs.filter((log) => matchesSource(log, sourceType));
    if (!incoming.length) return;

    setLogs((prev) => {
      const keySet = new Set(prev.map((entry) => toKey(entry)));
      let addedCount = 0;

      const next = [...prev];
      incoming.forEach((entry) => {
        const key = toKey(entry);
        if (keySet.has(key)) return;
        keySet.add(key);
        next.unshift(entry);
        addedCount += 1;
      });

      if (addedCount > 0) {
        setTotal((prevTotal) => prevTotal + addedCount);
      }

      return next.slice(0, limit);
    });
  }, [liveLogs, sourceType, limit]);

  return useMemo(
    () => ({
      logs,
      total,
      loading,
    }),
    [logs, total, loading],
  );
}
