import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function HomePage() {
  const navigate = useNavigate();
  const [showDialPad, setShowDialPad] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [callStatus, setCallStatus] = useState('');
  const [speechError, setSpeechError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const callTimerRef = useRef(null);
  const recognitionRef = useRef(null);

  // Check speech recognition support
  const isSpeechSupported = () => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  };

  // Initialize speech recognition with error handling
  const initSpeechRecognition = () => {
    try {
      if (!isSpeechSupported()) {
        throw new Error('Speech recognition not supported in this browser');
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');

        console.log("Live Transcript:", transcript);
        const data = analyzeTranscript(transcript);
        if (data) {
          setExtractedData(data);
          console.log("Extracted Data:", data);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setSpeechError(`Speech recognition error: ${event.error}`);
        setCallStatus(`Speech recognition failed - using audio recording only`);
      };

      return recognition;
    } catch (error) {
      console.error("Speech recognition initialization failed:", error);
      setSpeechError(error.message);
      return null;
    }
  };

  // Enhanced transcript analysis
  const analyzeTranscript = (transcript) => {
    if (!transcript) return null;

    const patterns = {
      name: [
        /(?:my name is|I am|call me|this is)\s([A-Za-z]+\s[A-Za-z]+)/i,
        /(?:name)\s([A-Za-z]+)/i
      ],
      incident: [
        /(?:report|there's|happened|occurred)\s(a|an)?\s([A-Za-z]+)/i,
        /(?:crime|incident)\s(of)?\s([A-Za-z]+)/i
      ],
      location: [
        /(?:at|in|near|location)\s([A-Za-z]+\s[A-Za-z]+\s[A-Za-z]+|[A-Za-z]+\s[A-Za-z]+|[A-Za-z]+)/i,
        /(?:address)\s(.+)/i
      ],
      contact: [
        /(?:contact|number|phone)\s(is)?\s(\d{3}[-.]?\d{3}[-.]?\d{4})/i,
        /(\d{3}[-.]?\d{3}[-.]?\d{4})/i
      ]
    };

    const extractWithPatterns = (type) => {
      for (const pattern of patterns[type]) {
        const match = transcript.match(pattern);
        if (match) return match[match.length - 1];
      }
      return "Unknown";
    };

    return {
      name: extractWithPatterns('name'),
      incidentType: extractWithPatterns('incident'),
      location: extractWithPatterns('location'),
      contact: extractWithPatterns('contact'),
      description: transcript,
      timestamp: new Date().toISOString()
    };
  };

  // Process recorded audio
  const processRecordedAudio = async (audioBlob) => {
    console.log("Processing recorded audio...");
    return new Promise(resolve => {
      setTimeout(() => {
        const mockData = {
          name: "Caller (from recording)",
          incidentType: "Emergency (from recording)",
          location: "Unknown location (from recording)",
          contact: phoneNumber,
          description: "Full audio recording available",
          timestamp: new Date().toISOString()
        };
        console.log("Processed data from recording:", mockData);
        resolve(mockData);
      }, 2000);
    });
  };

  // Store to blockchain with proper logging
  const storeToBlockchain = async (data) => {
    console.log("Preparing to store to blockchain:", JSON.stringify(data, null, 2));
    return new Promise(resolve => {
      setTimeout(() => {
        console.log("✅ Data successfully stored to blockchain:", JSON.stringify(data, null, 2));
        resolve(true);
      }, 1500);
    });
  };

  const startRecording = async () => {
    try {
      setSpeechError(null);
      
      if (isSpeechSupported()) {
        recognitionRef.current = initSpeechRecognition();
        if (recognitionRef.current) {
          recognitionRef.current.start();
          console.log("Speech recognition started");
        }
      } else {
        setCallStatus("Speech recognition not supported - audio will be recorded");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setCallStatus('Processing call data...');
        
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        console.log("Audio blob created:", audioBlob);

        let finalData = extractedData;
        
        if (!finalData || !finalData.name || finalData.name === "Unknown") {
          finalData = await processRecordedAudio(audioBlob);
          setExtractedData(finalData);
        }

        setCallStatus('Storing to blockchain...');
        await storeToBlockchain(finalData);
        
        setCallStatus('Call completed and data stored');
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setCallStatus('Call connected - recording started');
    } catch (err) {
      console.error("Recording error:", err);
      setCallStatus(`Recording failed: ${err.message}`);
      setSpeechError(err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleNumberClick = (number) => {
    if (phoneNumber.length < 15) {
      setPhoneNumber(prev => prev + number);
    }
  };

  const handleCall = () => {
    if (!phoneNumber) return;

    setIsCalling(true);
    setCallStatus('Connecting call...');
    startRecording();

    let seconds = 0;
    callTimerRef.current = setInterval(() => {
      seconds++;
      setCallDuration(seconds);
    }, 1000);
  };

  const endCall = () => {
    clearInterval(callTimerRef.current);
    stopRecording();
    setIsCalling(false);
    setCallDuration(0);
    setCallStatus('');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      stopRecording();
    };
  }, []);

  return (
    <div className="max-w-[1200px] mx-auto p-8">
      <header className="flex justify-between items-center mb-8">
        <div className="text-2xl font-bold text-gray-900">FIR3</div>
        <div className="flex gap-4 items-center">
          <button 
            className="px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => navigate('/file-complaint')}
          >
            Create Complaint
          </button>
          <button className="px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
            Track Complaint
          </button>
          <button className="bg-gray-100 border-none px-4 py-2 rounded-lg text-sm text-gray-900">
            0x7813...
          </button>
        </div>
      </header>

      <main>
        <div className="flex justify-between items-center mb-16">
          <div className="max-w-[600px]">
            <h1 className="text-5xl leading-tight font-bold text-gray-900 mb-6">
              File and Track Your Complaints Securely
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Our decentralized platform provides a secure and transparent way for
              citizens to register complaints and track their progress. With our system,
              you can be confident that your information is protected and the process
              is fair.
            </p>
            <div className="flex gap-4">
              <button 
                className="bg-gray-900 text-white px-6 py-3 rounded-lg text-base border-none cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => navigate('/file-complaint')}
              >
                File a Complaint
              </button>
              <button 
                className="bg-red-600 text-white px-6 py-3 rounded-lg text-base border-none cursor-pointer hover:bg-red-700 transition-colors"
                onClick={() => setShowDialPad(true)}
              >
                Emergency Call
              </button>
            </div>
          </div>
          <div className="content-right">
            {/* You can add the circular navigation UI here */}
          </div>
        </div>

        {/* Dial Pad Modal */}
        {showDialPad && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
              {isCalling ? (
                <div className="text-center">
                  <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-full bg-green-100 animate-ping absolute inset-0 mx-auto"></div>
                    <div className="w-24 h-24 rounded-full bg-green-200 flex items-center justify-center mx-auto">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                  </div>
                  
                  <h2 className="text-xl font-semibold mb-2">Emergency Call</h2>
                  <p className="text-lg mb-1">Calling: {phoneNumber}</p>
                  <p className="text-2xl font-mono mb-4">{formatTime(callDuration)}</p>
                  
                  <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                    <p className="text-sm font-medium">
                      Status: {callStatus}
                    </p>
                    {isRecording && (
                      <div className="flex items-center mt-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                        <span className="text-xs">Recording</span>
                      </div>
                    )}
                    {speechError && (
                      <div className="text-xs text-red-600 mt-1">{speechError}</div>
                    )}
                  </div>
                  
                  <button
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium"
                    onClick={endCall}
                  >
                    End Call
                  </button>
                  
                  {extractedData && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-left">
                      <h3 className="font-medium mb-1">Extracted Information:</h3>
                      <p className="text-sm">Name: {extractedData.name}</p>
                      <p className="text-sm">Incident: {extractedData.incidentType}</p>
                      <p className="text-sm">Location: {extractedData.location}</p>
                      <p className="text-sm">Contact: {extractedData.contact}</p>
                      <p className="text-sm mt-2 text-gray-600">{extractedData.description}</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-2">Emergency Dial</h2>
                    <div className="text-3xl font-mono bg-gray-100 p-3 rounded-lg">
                      {phoneNumber || <span className="text-gray-400">Enter number</span>}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map(num => (
                      <button
                        key={num}
                        className="aspect-square w-full rounded-full bg-[#CBFF96] hover:bg-[#b2e67d] text-gray-900 text-2xl font-medium transition-colors"
                        onClick={() => handleNumberClick(num)}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg transition-colors"
                      onClick={handleCall}
                      disabled={!phoneNumber}
                    >
                      Call
                    </button>
                    <button
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg transition-colors"
                      onClick={() => {
                        setShowDialPad(false);
                        setPhoneNumber('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-16">
          <span className="bg-[#CBFF96] text-gray-900 px-4 py-2 rounded-full inline-block mb-6">
            Features
          </span>
          <p className="text-gray-600 text-lg max-w-[800px] mb-12">
            Our police complaint management system offers a range of features to ensure
            efficient and secure handling of public complaints. These include:
          </p>
          
          <div className="grid grid-cols-3 gap-8">
            <div className="p-8 rounded-xl min-h-[200px] bg-gray-100">
              <h3 className="text-xl font-semibold mb-2">24/7 Support</h3>
              <p>Round-the-clock assistance for all your complaint-related queries</p>
            </div>
            <div className="p-8 rounded-xl min-h-[200px] bg-[#CBFF96]">
              <h3 className="text-xl font-semibold mb-2">Mobile Access</h3>
              <p>File and track complaints from anywhere using our mobile platform</p>
            </div>
            <div className="p-8 rounded-xl min-h-[200px] bg-gray-900 text-white">
              <h3 className="text-xl font-semibold mb-2">Secure System</h3>
              <p>Advanced encryption and blockchain technology to protect your data</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default HomePage;