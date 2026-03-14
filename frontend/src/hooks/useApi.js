// src/hooks/useApi.js
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * Generic fetcher hook with timeout support.
 * @param {Function} fetchFn - async function returning axios response
 * @param {Array}    deps    - re-fetch when these change
 * @param {Object}   options - { timeout: number in ms }
 */
export function useFetch(fetchFn, deps = [], options = {}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  
  // ✅ Default timeout: 5 seconds
  const timeout = options.timeout || 5000;

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    // ✅ Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      // ✅ Pass signal to fetchFn if it supports it
      const res = await Promise.race([
        fetchFn(controller.signal),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
      ]);
      
      clearTimeout(timeoutId);
      setData(res?.data || res);
    } catch (e) {
      clearTimeout(timeoutId);
      
      // ✅ Handle timeout vs other errors
      if (e.name === 'AbortError' || e.message === 'Request timeout') {
        setError('Connection timeout. Please check your internet.');
        console.warn('Fetch timed out after', timeout, 'ms');
      } else {
        setError(e.response?.data?.error || e.message);
      }
    } finally {
      setLoading(false); // ✅ Important: Always resolve loading
      controller.abort(); // ✅ Cleanup
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, timeout]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Mutation hook — wraps a POST/PUT/DELETE call with toast feedback + timeout.
 */
export function useMutation(mutFn, { onSuccess, successMsg = 'Done!', timeout = 10000 } = {}) {
  const [loading, setLoading] = useState(false);

  const mutate = async (...args) => {
    setLoading(true);
    
    // ✅ Timeout for mutations (longer: 10 seconds default)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const res = await Promise.race([
        mutFn(...args, controller.signal),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
      ]);
      
      clearTimeout(timeoutId);
      toast.success(successMsg);
      onSuccess?.(res.data);
      return res.data;
    } catch (e) {
      clearTimeout(timeoutId);
      
      if (e.name === 'AbortError' || e.message === 'Request timeout') {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error(e.response?.data?.error || e.message);
      }
      return null;
    } finally {
      setLoading(false);
      controller.abort();
    }
  };

  return { mutate, loading };
}