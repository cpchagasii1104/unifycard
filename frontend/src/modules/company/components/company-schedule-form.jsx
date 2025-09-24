import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/auth/contexts/auth-context';
import {
  getCompanyById,
  createSchedule,
} from '../services/company-service';

import styles from '../styles/company-schedule-form.module.css';

const CompanyScheduleForm = () => {
  const { user } = useContext(AuthContext);

  const [form, setForm] = useState({
    dayOfWeek: '',
    startTime: '',
    endTime: '',
    employeeId: '',
    branchId: '',
    title: '',
    isRecurring: true,
  });

  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [success, setSuccess] = useState(false);

  const fetchCompanyData = async () => {
    try {
      const data = await getCompanyById(user.companyId);
      setEmployees(data.employees || []);
      setBranches(data.branches || []);
    } catch (error) {
      console.error('Failed to load company data:', error);
    }
  };

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createSchedule(user.companyId, {
        ...form,
        companyId: user.companyId,
      });
      setForm({
        dayOfWeek: '',
        startTime: '',
        endTime: '',
        employeeId: '',
        branchId: '',
        title: '',
        isRecurring: true,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error creating schedule:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2>New Schedule</h2>

      <label>
        Title:
        <input
          type="text"
          name="title"
          value={form.title}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Day of the Week:
        <select
          name="dayOfWeek"
          value={form.dayOfWeek}
          onChange={handleChange}
          required
        >
          <option value="">Select a day</option>
          <option value="0">Sunday</option>
          <option value="1">Monday</option>
          <option value="2">Tuesday</option>
          <option value="3">Wednesday</option>
          <option value="4">Thursday</option>
          <option value="5">Friday</option>
          <option value="6">Saturday</option>
        </select>
      </label>

      <label>
        Start Time:
        <input
          type="time"
          name="startTime"
          value={form.startTime}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        End Time:
        <input
          type="time"
          name="endTime"
          value={form.endTime}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Employee:
        <select
          name="employeeId"
          value={form.employeeId}
          onChange={handleChange}
        >
          <option value="">Select</option>
          {employees.map((emp) => (
            <option key={emp.companyEmployeeId} value={emp.companyEmployeeId}>
              {emp.name || emp.user?.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Branch:
        <select
          name="branchId"
          value={form.branchId}
          onChange={handleChange}
        >
          <option value="">Select</option>
          {branches.map((b) => (
            <option key={b.companyBranchId} value={b.companyBranchId}>
              {b.name || `${b.city} - ${b.state}`}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          name="isRecurring"
          checked={form.isRecurring}
          onChange={handleChange}
        />
        Recurring every week
      </label>

      <button type="submit">Save Schedule</button>

      {success && <p className={styles.success}>Schedule created!</p>}
    </form>
  );
};

export default CompanyScheduleForm;
