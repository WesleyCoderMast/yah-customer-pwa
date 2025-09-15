import { supabase } from './db';
import { paymentService } from './paymentService';

export interface DriverPayoutData {
  driverId: string;
  amount: { currency: string; value: number };
  bankAccount: {
    accountNumber: string;
    bankCode: string;
    countryCode: string;
    ownerName: string;
  };
  description?: string;
}

export interface CEOPayoutData {
  ceoId: string;
  amount: { currency: string; value: number };
  bankAccount: {
    accountNumber: string;
    bankCode: string;
    countryCode: string;
    ownerName: string;
  };
  description?: string;
}

export class ScheduledPayoutService {
  private isRunning = false;

  /**
   * Start the scheduled payout service
   */
  start() {
    if (this.isRunning) {
      console.log('Scheduled payout service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting scheduled payout service...');

    // Run every day at 2 AM
    this.scheduleDailyPayouts();
    
    // Run every week on Sunday at 3 AM
    this.scheduleWeeklyPayouts();
    
    // Run every month on the 1st at 4 AM
    this.scheduleMonthlyPayouts();
  }

  /**
   * Stop the scheduled payout service
   */
  stop() {
    this.isRunning = false;
    console.log('Scheduled payout service stopped');
  }

  /**
   * Schedule daily payouts (for drivers with daily payout preference)
   */
  private scheduleDailyPayouts() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0); // 2 AM

    const timeUntilTomorrow = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      if (this.isRunning) {
        this.processDailyPayouts();
        // Schedule next day
        setInterval(() => {
          if (this.isRunning) {
            this.processDailyPayouts();
          }
        }, 24 * 60 * 60 * 1000); // 24 hours
      }
    }, timeUntilTomorrow);
  }

  /**
   * Schedule weekly payouts (for drivers with weekly payout preference)
   */
  private scheduleWeeklyPayouts() {
    const now = new Date();
    const nextSunday = new Date(now);
    const daysUntilSunday = (7 - now.getDay()) % 7;
    nextSunday.setDate(now.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
    nextSunday.setHours(3, 0, 0, 0); // 3 AM

    const timeUntilSunday = nextSunday.getTime() - now.getTime();

    setTimeout(() => {
      if (this.isRunning) {
        this.processWeeklyPayouts();
        // Schedule next week
        setInterval(() => {
          if (this.isRunning) {
            this.processWeeklyPayouts();
          }
        }, 7 * 24 * 60 * 60 * 1000); // 7 days
      }
    }, timeUntilSunday);
  }

  /**
   * Schedule monthly payouts (for CEO and drivers with monthly payout preference)
   */
  private scheduleMonthlyPayouts() {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(4, 0, 0, 0); // 4 AM

    const timeUntilNextMonth = nextMonth.getTime() - now.getTime();

    setTimeout(() => {
      if (this.isRunning) {
        this.processMonthlyPayouts();
        // Schedule next month
        setInterval(() => {
          if (this.isRunning) {
            this.processMonthlyPayouts();
          }
        }, 30 * 24 * 60 * 60 * 1000); // 30 days (approximate)
      }
    }, timeUntilNextMonth);
  }

  /**
   * Process daily payouts for drivers
   */
  private async processDailyPayouts() {
    try {
      console.log('Processing daily payouts...');

      // Get drivers with daily payout preference and pending earnings
      const { data: drivers, error } = await supabase
        .from('drivers')
        .select(`
          id,
          name,
          email,
          payout_frequency,
          bank_account,
          pending_earnings
        `)
        .eq('payout_frequency', 'daily')
        .gt('pending_earnings', 0)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching drivers for daily payout:', error);
        return;
      }

      if (!drivers || drivers.length === 0) {
        console.log('No drivers eligible for daily payout');
        return;
      }

      const payoutData = drivers.map(driver => ({
        recipientId: driver.id,
        recipientType: 'driver' as const,
        amount: {
          currency: 'USD', // Default currency, should be configurable
          value: Math.round(driver.pending_earnings * 100) // Convert to minor units
        },
        bankAccount: driver.bank_account,
        description: `Daily payout for ${driver.name}`
      }));

      // Process payouts
      const results = await paymentService.processPeriodicPayouts(payoutData);

      // Update driver balances
      for (const result of results) {
        if (result.success) {
          const driver = drivers.find(d => d.id === result.recipientId);
          if (driver) {
            // Reset pending earnings
            await supabase
              .from('drivers')
              .update({ 
                pending_earnings: 0,
                last_payout_date: new Date().toISOString()
              })
              .eq('id', result.recipientId);

            console.log(`Daily payout processed for driver ${result.recipientId}: ${driver.pending_earnings}`);
          }
        }
      }

      console.log(`Daily payouts completed: ${results.filter(r => r.success).length}/${results.length} successful`);

    } catch (error) {
      console.error('Error processing daily payouts:', error);
    }
  }

  /**
   * Process weekly payouts for drivers
   */
  private async processWeeklyPayouts() {
    try {
      console.log('Processing weekly payouts...');

      // Get drivers with weekly payout preference and pending earnings
      const { data: drivers, error } = await supabase
        .from('drivers')
        .select(`
          id,
          name,
          email,
          payout_frequency,
          bank_account,
          pending_earnings
        `)
        .eq('payout_frequency', 'weekly')
        .gt('pending_earnings', 0)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching drivers for weekly payout:', error);
        return;
      }

      if (!drivers || drivers.length === 0) {
        console.log('No drivers eligible for weekly payout');
        return;
      }

      const payoutData = drivers.map(driver => ({
        recipientId: driver.id,
        recipientType: 'driver' as const,
        amount: {
          currency: 'USD',
          value: Math.round(driver.pending_earnings * 100)
        },
        bankAccount: driver.bank_account,
        description: `Weekly payout for ${driver.name}`
      }));

      // Process payouts
      const results = await paymentService.processPeriodicPayouts(payoutData);

      // Update driver balances
      for (const result of results) {
        if (result.success) {
          const driver = drivers.find(d => d.id === result.recipientId);
          if (driver) {
            // Reset pending earnings
            await supabase
              .from('drivers')
              .update({ 
                pending_earnings: 0,
                last_payout_date: new Date().toISOString()
              })
              .eq('id', result.recipientId);

            console.log(`Weekly payout processed for driver ${result.recipientId}: ${driver.pending_earnings}`);
          }
        }
      }

      console.log(`Weekly payouts completed: ${results.filter(r => r.success).length}/${results.length} successful`);

    } catch (error) {
      console.error('Error processing weekly payouts:', error);
    }
  }

  /**
   * Process monthly payouts for CEO and drivers with monthly preference
   */
  private async processMonthlyPayouts() {
    try {
      console.log('Processing monthly payouts...');

      // Get CEO payout data
      const { data: ceoData, error: ceoError } = await supabase
        .from('ceo_payouts')
        .select('*')
        .eq('status', 'pending')
        .single();

      // Get drivers with monthly payout preference
      const { data: drivers, error: driverError } = await supabase
        .from('drivers')
        .select(`
          id,
          name,
          email,
          payout_frequency,
          bank_account,
          pending_earnings
        `)
        .eq('payout_frequency', 'monthly')
        .gt('pending_earnings', 0)
        .eq('status', 'active');

      if (driverError) {
        console.error('Error fetching drivers for monthly payout:', driverError);
        return;
      }

      const payouts = [];

      // Add CEO payout if available
      if (ceoData && !ceoError) {
        payouts.push({
          recipientId: ceoData.ceo_id,
          recipientType: 'ceo' as const,
          amount: {
            currency: ceoData.currency || 'USD',
            value: Math.round(ceoData.amount * 100)
          },
          bankAccount: ceoData.bank_account,
          description: `Monthly CEO payout`
        });
      }

      // Add driver payouts
      if (drivers && drivers.length > 0) {
        const driverPayouts = drivers.map(driver => ({
          recipientId: driver.id,
          recipientType: 'driver' as const,
          amount: {
            currency: 'USD',
            value: Math.round(driver.pending_earnings * 100)
          },
          bankAccount: driver.bank_account,
          description: `Monthly payout for ${driver.name}`
        }));

        payouts.push(...driverPayouts);
      }

      if (payouts.length === 0) {
        console.log('No payouts eligible for monthly processing');
        return;
      }

      // Process payouts
      const results = await paymentService.processPeriodicPayouts(payouts);

      // Update balances
      for (const result of results) {
        if (result.success) {
          if (result.recipientType === 'ceo') {
            // Update CEO payout status
            await supabase
              .from('ceo_payouts')
              .update({ 
                status: 'completed',
                processed_at: new Date().toISOString()
              })
              .eq('ceo_id', result.recipientId)
              .eq('status', 'pending');
          } else if (result.recipientType === 'driver') {
            // Reset driver pending earnings
            await supabase
              .from('drivers')
              .update({ 
                pending_earnings: 0,
                last_payout_date: new Date().toISOString()
              })
              .eq('id', result.recipientId);
          }

          console.log(`Monthly payout processed for ${result.recipientType} ${result.recipientId}`);
        }
      }

      console.log(`Monthly payouts completed: ${results.filter(r => r.success).length}/${results.length} successful`);

    } catch (error) {
      console.error('Error processing monthly payouts:', error);
    }
  }

  /**
   * Manually trigger payouts (for testing or emergency use)
   */
  async triggerPayouts(type: 'daily' | 'weekly' | 'monthly') {
    console.log(`Manually triggering ${type} payouts...`);

    switch (type) {
      case 'daily':
        await this.processDailyPayouts();
        break;
      case 'weekly':
        await this.processWeeklyPayouts();
        break;
      case 'monthly':
        await this.processMonthlyPayouts();
        break;
    }
  }

  /**
   * Get payout statistics
   */
  async getPayoutStats() {
    try {
      const { data: stats, error } = await supabase
        .from('adyen_payouts')
        .select('*')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      if (error) {
        console.error('Error fetching payout stats:', error);
        return null;
      }

      const totalPayouts = stats?.length || 0;
      const successfulPayouts = stats?.filter(p => p.status === 'Received').length || 0;
      const totalAmount = stats?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      return {
        totalPayouts,
        successfulPayouts,
        failedPayouts: totalPayouts - successfulPayouts,
        totalAmount,
        successRate: totalPayouts > 0 ? (successfulPayouts / totalPayouts) * 100 : 0
      };

    } catch (error) {
      console.error('Error getting payout stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const scheduledPayoutService = new ScheduledPayoutService();
