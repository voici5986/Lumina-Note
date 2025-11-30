import { useEffect, useRef, useState, useCallback } from "react";

/**
 * 语音转文字 Hook，基于 Web Speech API。
 * 支持流式显示中间结果和最终结果追加。
 */
export function useSpeechToText(appendText: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState(""); // 中间结果（流式显示）
  const recognitionRef = useRef<any | null>(null);
  const appendTextRef = useRef(appendText);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 保持 appendText 最新引用
  useEffect(() => {
    appendTextRef.current = appendText;
  }, [appendText]);

  // 清除静音计时器
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // 重置静音计时器（6秒无声音自动停止）
  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.stop();
      }
    }, 6000);
  }, [clearSilenceTimer]);

  useEffect(() => {
    const SpeechRecognitionImpl =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      
      // 更新中间结果（流式显示）
      setInterimText(interim);
      
      // 有说话活动时重置计时器
      resetSilenceTimer();
      
      // 最终结果追加到输入框，并清空中间结果
      if (final) {
        appendTextRef.current(final);
        setInterimText("");
      }
    };

    recognition.onend = () => {
      clearSilenceTimer();
      setIsRecording(false);
      setInterimText("");
    };

    recognition.onerror = () => {
      clearSilenceTimer();
      setIsRecording(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimer();
      recognition.stop();
    };
  }, [resetSilenceTimer, clearSilenceTimer]);

  const toggleRecording = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      alert("当前环境不支持语音输入");
      return;
    }

    if (isRecording) {
      clearSilenceTimer();
      recognition.stop();
      setIsRecording(false);
    } else {
      try {
        recognition.start();
        setIsRecording(true);
        // 开始录音时启动静音计时器，如果一直没说话也会自动停止
        resetSilenceTimer();
      } catch (e) {
        console.error("Failed to start speech recognition", e);
        setIsRecording(false);
      }
    }
  }, [isRecording, clearSilenceTimer, resetSilenceTimer]);

  return { isRecording, interimText, toggleRecording };
}
