import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from datetime import datetime, timezone, timedelta
import logging

async def send_analytics_report(analytics_tracker, business_email: str):
    """Send analytics email report"""
    try:
        now = datetime.now(timezone.utc)
        three_hours_ago = now - timedelta(hours=3)
        
        # Get stats
        all_time_stats = await analytics_tracker.get_stats()
        last_3h_stats = await analytics_tracker.get_stats(three_hours_ago)
        
        smtp_host = os.environ['SMTP_HOST']
        smtp_port = int(os.environ['SMTP_PORT'])
        smtp_user = os.environ['SMTP_USER']
        smtp_password = os.environ['SMTP_PASSWORD']
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'Celesta Glow Analytics Report - {now.strftime("%Y-%m-%d %H:%M")} UTC'
        msg['From'] = smtp_user
        msg['To'] = business_email
        
        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
              <div style="background: linear-gradient(135deg, #4C1D95, #6d28d9); color: white; padding: 30px; text-align: center; border-radius: 10px;">
                <h1 style="margin: 0; font-size: 24px;">📊 Celesta Glow Analytics Report</h1>
                <p style="margin: 10px 0 0; font-size: 14px;">Report Period: Last 3 Hours</p>
                <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.9;">{now.strftime("%B %d, %Y at %H:%M UTC")}</p>
              </div>
              
              <div style="background: white; padding: 25px; margin-top: 20px; border-radius: 10px;">
                <h2 style="color: #4C1D95; margin-bottom: 20px; font-size: 20px;">Last 3 Hours Performance</h2>
                
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                  <h3 style="color: #1E293B; margin: 0 0 10px 0; font-size: 16px;">👥 Visitor Overview</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Total Visits (3h):</strong></td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #059669; font-weight: bold;">{last_3h_stats['total_visits']}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Today's Total Visits:</strong></td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #059669; font-weight: bold;">{all_time_stats['today_visits']}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Unique Visitors (3h):</strong></td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #4C1D95; font-weight: bold;">{last_3h_stats['unique_sessions']}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                  <h3 style="color: #1E293B; margin: 0 0 10px 0; font-size: 16px;">📊 Page-by-Page Breakdown (Last 3h)</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Product Page:</strong></td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{last_3h_stats['page_breakdown']['product_page']} visits</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Address/Checkout Page:</strong></td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{last_3h_stats['page_breakdown']['address_page']} visits</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Payment Page:</strong></td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{last_3h_stats['page_breakdown']['payment_page']} visits</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 15px; border-radius: 5px; margin-top: 20px;">
                  <h3 style="color: #92400E; margin: 0 0 10px 0; font-size: 16px;">🌟 All-Time Statistics</h3>
                  <p style="margin: 5px 0; color: #92400E;"><strong>Total Visits:</strong> {all_time_stats['total_visits']}</p>
                  <p style="margin: 5px 0; color: #92400E;"><strong>Product Page:</strong> {all_time_stats['page_breakdown']['product_page']} | <strong>Checkout:</strong> {all_time_stats['page_breakdown']['address_page']} | <strong>Payment:</strong> {all_time_stats['page_breakdown']['payment_page']}</p>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
                <p>Next report will be sent in 3 hours</p>
                <p style="margin-top: 10px;">&copy; 2025 Celesta Glow Analytics</p>
              </div>
            </div>
          </body>
        </html>
        """
        
        part = MIMEText(html, 'html')
        msg.attach(part)
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        
        logging.info(f"Analytics report sent to {business_email}")
        return True
    except Exception as e:
        logging.error(f"Failed to send analytics report: {str(e)}")
        return False
