import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  MessageSquare, 
  Send, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowLeft,
  RefreshCw,
  Phone,
  AlertCircle
} from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AdminWhatsApp() {
  const navigate = useNavigate();
  const { adminToken, isLoading: authLoading, isAuthenticated } = useAdminAuth(navigate);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [activeTab, setActiveTab] = useState('send');
  const [sendForm, setSendForm] = useState({ phone: '', message: '' });
  const [testPhone, setTestPhone] = useState('');
  const [sendStatus, setSendStatus] = useState(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    fetchData();
  }, [authLoading, isAuthenticated]);

  const fetchData = async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const [statsRes, logsRes, ordersRes, consultRes] = await Promise.all([
        axios.get(`${API}/admin/whatsapp/stats`, { headers: { 'x-admin-token': adminToken } }),
        axios.get(`${API}/admin/whatsapp/logs?limit=20`, { headers: { 'x-admin-token': adminToken } }),
        axios.get(`${API}/orders`),
        axios.get(`${API}/consultations`, { headers: { 'x-admin-token': adminToken } }).catch(() => ({ data: [] }))
      ]);
      
      setStats(statsRes.data);
      setLogs(logsRes.data.logs || []);
      setOrders(ordersRes.data || []);
      setConsultations(consultRes.data || []);
    } catch (error) {
      console.error('Error fetching WhatsApp data:', error);
    }
    setLoading(false);
  };

  const getWhatsAppErrorMessage = (error) => {
    // Map WhatsApp error codes to user-friendly messages
    const errorCode = error?.error_code;
    const errorMsg = error?.error || error?.message || '';
    
    if (errorCode === 133010 || errorMsg.includes('not registered')) {
      return 'This phone number is not registered on WhatsApp. Please verify the number has WhatsApp installed.';
    }
    if (errorCode === 131047 || errorMsg.includes('invalid')) {
      return 'Invalid phone number format. Please enter a valid 10-digit Indian mobile number.';
    }
    if (errorCode === 131026) {
      return 'Message failed to send. The recipient may have blocked business messages.';
    }
    if (errorCode === 131021) {
      return 'Rate limit exceeded. Please wait a few minutes before sending more messages.';
    }
    if (errorMsg.includes('authorization') || errorMsg.includes('token')) {
      return 'WhatsApp API authorization failed. Please check your API credentials.';
    }
    
    return errorMsg || 'Failed to send message. Please try again.';
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!sendForm.phone || !sendForm.message) return;
    
    setLoading(true);
    setSendStatus(null);
    
    try {
      const response = await axios.post(
        `${API}/admin/whatsapp/send`,
        { phone: sendForm.phone, message: sendForm.message },
        { headers: { 'x-admin-token': adminToken } }
      );
      
      if (response.data.success) {
        setSendStatus({ type: 'success', message: 'Message sent successfully!' });
        setSendForm({ phone: '', message: '' });
      } else {
        setSendStatus({ type: 'error', message: getWhatsAppErrorMessage(response.data) });
      }
      fetchData();
    } catch (error) {
      const errorData = error.response?.data;
      setSendStatus({ 
        type: 'error', 
        message: getWhatsAppErrorMessage(errorData) || error.response?.data?.detail || 'Failed to send message' 
      });
    }
    setLoading(false);
  };

  const handleTestConnection = async () => {
    if (!testPhone) return;
    
    setLoading(true);
    setSendStatus(null);
    
    try {
      const response = await axios.post(
        `${API}/admin/whatsapp/test?phone=${encodeURIComponent(testPhone)}`,
        {},
        { headers: { 'x-admin-token': adminToken } }
      );
      
      if (response.data.success) {
        setSendStatus({ type: 'success', message: 'Test message sent! Check your WhatsApp.' });
      } else {
        setSendStatus({ type: 'error', message: getWhatsAppErrorMessage(response.data) });
      }
      fetchData();
    } catch (error) {
      const errorData = error.response?.data;
      setSendStatus({ 
        type: 'error', 
        message: getWhatsAppErrorMessage(errorData) || 'Test failed' 
      });
    }
    setLoading(false);
  };

  const handleNotifyOrder = async (orderId) => {
    setLoading(true);
    try {
      await axios.post(
        `${API}/admin/whatsapp/notify-order`,
        { order_id: orderId },
        { headers: { 'x-admin-token': adminToken } }
      );
      alert('Order notification sent via WhatsApp!');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to send notification');
    }
    setLoading(false);
  };

  const handleNotifyConsultation = async (consultationId) => {
    setLoading(true);
    try {
      await axios.post(
        `${API}/admin/whatsapp/notify-consultation`,
        { consultation_id: consultationId },
        { headers: { 'x-admin-token': adminToken } }
      );
      alert('Consultation results sent via WhatsApp!');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to send notification');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 hover:bg-gray-100 rounded-lg"
                data-testid="back-btn"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="text-green-600" size={24} />
                  WhatsApp Integration
                </h1>
                <p className="text-sm text-gray-500">Send notifications to customers</p>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="p-2 hover:bg-gray-100 rounded-lg"
              disabled={loading}
              data-testid="refresh-btn"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <MessageSquare size={16} />
                Total Messages
              </div>
              <p className="text-2xl font-bold">{stats.total_messages}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                <CheckCircle size={16} />
                Sent
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 text-red-500 text-sm mb-1">
                <XCircle size={16} />
                Failed
              </div>
              <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 text-purple-600 text-sm mb-1">
                <Users size={16} />
                Success Rate
              </div>
              <p className="text-2xl font-bold text-purple-600">{stats.success_rate}%</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
                <Clock size={16} />
                Today
              </div>
              <p className="text-2xl font-bold text-blue-600">{stats.today_messages}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['send', 'orders', 'consultations', 'logs'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
              data-testid={`tab-${tab}`}
            >
              {tab === 'send' && 'Send Message'}
              {tab === 'orders' && 'Order Notifications'}
              {tab === 'consultations' && 'Consultation Results'}
              {tab === 'logs' && 'Message Logs'}
            </button>
          ))}
        </div>

        {/* Status Message */}
        {sendStatus && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
            sendStatus.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {sendStatus.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            {sendStatus.message}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'send' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* WhatsApp Setup Note */}
            <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h4 className="font-medium text-amber-800 mb-2">Important: WhatsApp Business API Requirements</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• Recipients must have WhatsApp installed on their phone</li>
                <li>• For business-initiated messages, recipients must first message your business number OR be added as test numbers in Meta Business Manager</li>
                <li>• Go to Meta Business Suite → WhatsApp Manager → Phone Numbers → Add test numbers</li>
              </ul>
            </div>

            {/* Send Custom Message */}
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Send size={18} />
                Send Custom Message
              </h3>
              <form onSubmit={handleSendMessage} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={sendForm.phone}
                    onChange={(e) => setSendForm({ ...sendForm, phone: e.target.value })}
                    placeholder="10-digit phone number"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    data-testid="send-phone-input"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Message</label>
                  <textarea
                    value={sendForm.message}
                    onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                    placeholder="Enter your message..."
                    rows={4}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    data-testid="send-message-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !sendForm.phone || !sendForm.message}
                  className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="send-btn"
                >
                  <Send size={18} />
                  Send Message
                </button>
              </form>
            </div>

            {/* Test Connection */}
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Phone size={18} />
                Test WhatsApp Connection
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Send a test message to verify your WhatsApp integration is working correctly.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Your Phone Number</label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="10-digit phone number"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    data-testid="test-phone-input"
                  />
                </div>
                <button
                  onClick={handleTestConnection}
                  disabled={loading || !testPhone}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="test-btn"
                >
                  <MessageSquare size={18} />
                  Send Test Message
                </button>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Quick Templates</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => setSendForm({ 
                      ...sendForm, 
                      message: "Hi! Thank you for your interest in Celesta Glow. How can we help you today?" 
                    })}
                    className="w-full text-left p-2 bg-white rounded border hover:bg-gray-50 text-sm"
                  >
                    Welcome Message
                  </button>
                  <button
                    onClick={() => setSendForm({ 
                      ...sendForm, 
                      message: "Your order has been shipped! Track your delivery at celestaglow.com. Thank you for choosing Celesta Glow!" 
                    })}
                    className="w-full text-left p-2 bg-white rounded border hover:bg-gray-50 text-sm"
                  >
                    Shipping Update
                  </button>
                  <button
                    onClick={() => setSendForm({ 
                      ...sendForm, 
                      message: "Exclusive offer for you! Get 10% OFF on your next purchase. Use code: GLOW10. Valid for 7 days." 
                    })}
                    className="w-full text-left p-2 bg-white rounded border hover:bg-gray-50 text-sm"
                  >
                    Promotional Offer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900">Recent Orders - Send WhatsApp Notifications</h3>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {orders.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No orders found
                </div>
              ) : (
                orders.slice(0, 20).map((order) => (
                  <div key={order.order_id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{order.name}</p>
                      <p className="text-sm text-gray-500">
                        {order.order_id} • {order.phone} • Rs.{order.amount}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.created_at).toLocaleDateString()}
                        {order.whatsapp_notified && (
                          <span className="ml-2 text-green-600">WhatsApp sent</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleNotifyOrder(order.order_id)}
                      disabled={loading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                      data-testid={`notify-order-${order.order_id}`}
                    >
                      <MessageSquare size={16} />
                      Send
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'consultations' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900">Consultations - Send Results via WhatsApp</h3>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {consultations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No consultations found
                </div>
              ) : (
                consultations.slice(0, 20).map((consultation) => (
                  <div key={consultation.consultation_id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{consultation.name}</p>
                      <p className="text-sm text-gray-500">
                        {consultation.consultation_id} • {consultation.phone}
                      </p>
                      <p className="text-xs text-gray-400">
                        {consultation.skin_type} • {consultation.concerns?.join(', ')}
                        {consultation.whatsapp_result_sent && (
                          <span className="ml-2 text-green-600">Results sent</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleNotifyConsultation(consultation.consultation_id)}
                      disabled={loading}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                      data-testid={`notify-consultation-${consultation.consultation_id}`}
                    >
                      <MessageSquare size={16} />
                      Send Results
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900">Message Logs</h3>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No messages sent yet
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={log.id || `msg-${idx}`} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-gray-400" />
                          <span className="font-medium">{log.phone}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            log.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {log.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{log.content}</p>
                        {log.error && (
                          <p className="text-xs text-red-500 mt-1">{log.error}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminWhatsApp;
