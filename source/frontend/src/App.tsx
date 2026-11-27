import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WizardProvider } from './context/WizardContext';
import { AutoSaveProvider } from './context/AutoSaveContext';
import { FilterProvider } from './context/FilterContext';
import { StudioProvider } from './studio/StudioContext';
import { RedirectTo, RedirectToSummary } from './studio/Redirects';
import Layout from './components/Layout';
import Login from './pages/Login';
import OAuthCallback from './pages/OAuthCallback';
import Launch from './pages/Launch';
import Home from './pages/Home';
import Voice1S from './pages/Voice1S';
import PipelineSelection from './pages/PipelineSelection';
import SpeechToSpeech from './pages/SpeechToSpeech';
import CascadedSpeech from './pages/CascadedSpeech';
import Agents from './pages/Agents';
import PromptBuilder from './pages/PromptBuilder';
import Summary from './pages/Summary';
import POC from './pages/POC';
import AgentDetail from './pages/AgentDetail';
import StartFromScratch from './pages/StartFromScratch';
import RAG from './pages/integrations/RAG';
import Tools from './pages/integrations/Tools';
import Skills from './pages/integrations/Skills';
import SubAgents from './pages/integrations/SubAgents';
import Settings from './pages/Settings';
import PSTN from './pages/telephony/PSTN';
import SIP from './pages/telephony/SIP';
import PhoneNumbers from './pages/telephony/PhoneNumbers';
import EvalSuites from './pages/EvalSuites';
import EvalSuiteDetail from './pages/EvalSuiteDetail';
import EvalSuiteCompare from './pages/EvalSuiteCompare';
import AgentsHome from './pages/studio/AgentsHome';
import More from './pages/studio/More';
import CallsPage from './pages/studio/CallsPage';
import CallReview from './pages/studio/CallReview';
import EvalsPage from './pages/studio/EvalsPage';

function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: '#545b64', fontSize: '14px' }}>Loading...</p>
      </div>
    );
  }

  if (window.location.pathname === '/callback') {
    return <OAuthCallback />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <FilterProvider>
    <WizardProvider>
      <BrowserRouter>
      <AutoSaveProvider>
      <StudioProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/agents" replace />} />
            <Route path="/home" element={<Navigate to="/start" replace />} />
            <Route path="/launch" element={<RedirectTo to="/start?open=templates" />} />
            <Route path="/start" element={<StartFromScratch />} />
            <Route path="/setup" element={<Home />} />
            <Route path="/voice-1s" element={<RedirectToSummary sheet="voice" />} />
            <Route path="/pipeline" element={<RedirectToSummary sheet="pipeline" />} />
            <Route path="/speech-to-speech" element={<RedirectToSummary sheet="pipeline" />} />
            <Route path="/cascaded" element={<RedirectToSummary sheet="pipeline" />} />
            <Route path="/tools-selection" element={<Agents />} />
            <Route path="/prompt-builder" element={<RedirectToSummary sheet="persona" />} />
            <Route path="/summary" element={<Summary />} />
            <Route path="/poc" element={<POC />} />
            <Route path="/agents" element={<AgentsHome />} />
            <Route path="/agents/:id" element={<AgentDetail />} />
            <Route path="/agents/:id/summary" element={<AgentDetail />} />
            <Route path="/agents/:id/workflow" element={<AgentDetail />} />
            <Route path="/agents/:id/conversations" element={<AgentDetail />} />
            <Route path="/agents/:id/users" element={<AgentDetail />} />
            <Route path="/agents/:id/cost" element={<AgentDetail />} />
            <Route path="/agents/:id/evaluation" element={<AgentDetail />} />
            <Route path="/agents/:id/evaluation/:jobId" element={<AgentDetail />} />
            <Route path="/calls" element={<CallsPage />} />
            <Route path="/calls/:sessionId" element={<CallReview />} />
            <Route path="/evals" element={<EvalsPage />} />
            <Route path="/more" element={<More />} />
            <Route path="/integrations/rag" element={<RAG />} />
            <Route path="/integrations/tools" element={<Tools />} />
            <Route path="/integrations/skills" element={<Skills />} />
            <Route path="/integrations/sub-agents" element={<SubAgents />} />
            <Route path="/telephony/twilio" element={<RedirectTo to="/telephony/phone-numbers?guide=twilio" />} />
            <Route path="/telephony/sip" element={<RedirectTo to="/telephony/phone-numbers?guide=sip" />} />
            <Route path="/sip" element={<RedirectTo to="/telephony/phone-numbers?guide=sip" />} />
            <Route path="/telephony/phone-numbers" element={<PhoneNumbers />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/eval-suites" element={<EvalsPage />} />
            <Route path="/eval-suites/manage" element={<EvalSuites />} />
            <Route path="/eval-suites/:id" element={<EvalSuiteDetail />} />
            <Route path="/eval-suites/:id/compare" element={<EvalSuiteCompare />} />
            {/* Keep original wizard pages reachable for debugging via /legacy/* without deleting them */}
            <Route path="/legacy/voice-1s" element={<Voice1S />} />
            <Route path="/legacy/pipeline" element={<PipelineSelection />} />
            <Route path="/legacy/speech-to-speech" element={<SpeechToSpeech />} />
            <Route path="/legacy/cascaded" element={<CascadedSpeech />} />
            <Route path="/legacy/prompt-builder" element={<PromptBuilder />} />
            <Route path="/legacy/launch" element={<Launch />} />
            <Route path="/legacy/twilio" element={<PSTN />} />
            <Route path="/legacy/sip" element={<SIP />} />
          </Route>
        </Routes>
      </StudioProvider>
      </AutoSaveProvider>
      </BrowserRouter>
    </WizardProvider>
    </FilterProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;
