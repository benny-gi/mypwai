import React, { useEffect, useState } from 'react';
import { fetchStudents, addStudent, deleteStudent } from '../api'; // addStudent also handles updates
import { enrollFaceToRekognitionCollection, getRekognitionCollectionStatus, initializeRekognitionCollection, checkDuplicateFaceEnrollment } from '../apiExtra';

const StudentManagementPage: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [form, setForm] = useState({ index: '', name: '', programme: '', level: '', photo: '' });
  const [loading, setLoading] = useState(false);
  const [syncingAllFaces, setSyncingAllFaces] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingIndex, setEditingIndex] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIndices, setSelectedIndices] = useState<Set<string>>(new Set());
  const [viewStudent, setViewStudent] = useState<any | null>(null);
  const itemsPerPage = 5;

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    fetchStudents().then(setStudents).catch(() => setError('Failed to load students'));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxDimension = 900;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext('2d');
        if (!context) {
          setForm({ ...form, photo: reader.result as string });
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const compressedPhoto = canvas.toDataURL('image/jpeg', 0.88);
        setForm({ ...form, photo: compressedPhoto });
      };

      image.onerror = () => {
        setForm({ ...form, photo: reader.result as string });
      };

      image.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    if (!form.index || !form.name || !form.programme || !form.level) {
      setError('All fields (Index, Name, Programme, Level) are required');
      return;
    }

    // Require profile photo for all new students (and for editing if no photo exists)
    if (!form.photo) {
      setError('A profile photo is required. Please upload a clear photo of the student for face recognition.');
      return;
    }

    if (!editingIndex && students.some(s => s.index === form.index)) {
      setError('A student with this Index Number already exists.');
      return;
    }

    if (editingIndex && form.index !== editingIndex && students.some(s => s.index === form.index)) {
      setError('Another student with this Index Number already exists.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const studentId = form.index.trim();
      const hasPhoto = typeof form.photo === 'string' && form.photo.length > 0;

      // Save basic student profile first.
      // Note: faceEnrolled will be set below after AWS Rekognition verifies a face is detectable in the photo
      await addStudent(form);
      // If the index was changed during edit, remove the old record to complete the rename.
      if (editingIndex && form.index !== editingIndex) {
        try {
          await deleteStudent(editingIndex);
        } catch (delErr) {
          // Non-fatal: log to error state but continue to reload students
          console.error('Failed to remove old student index after rename', delErr);
        }
      }

      // Face enrollment: AWS Rekognition must detect a face in the photo to mark as enrolled
      if (hasPhoto) {
        try {
          const imageBase64 = extractBase64Payload(form.photo);
          if (imageBase64) {
            // First ensure the Rekognition collection exists
            await ensureCollectionReady();

            // Check if this face already belongs to a different student
            const duplicateCheck = await checkDuplicateFaceEnrollment(imageBase64, studentId);
            if (duplicateCheck.isDuplicate) {
              setError(`This face photo matches an existing enrollment for student: ${duplicateCheck.matchedStudentId}. A student's face may only be enrolled once.`);
              // Revert: delete the student we just added if it's a new one
              if (!editingIndex) {
                await deleteStudent(studentId).catch(() => {});
              }
              await loadStudents();
              setLoading(false);
              return;
            }

            // No duplicate found, proceed with enrollment.
            // AWS Rekognition will detect the face in the photo and index it.
            // Only if a face is successfully detected AND indexed will enrolled be true.
            const enrollmentResult = await enrollFaceToRekognitionCollection({ imageBase64, studentId });
            const enrollmentSucceeded = enrollmentResult?.enrolled === true;
            
            // Update the student record with the face enrollment status
            await addStudent({ ...form, faceEnrolled: enrollmentSucceeded });
            
            if (enrollmentSucceeded) {
              setNotice(`Student saved. Face enrolled successfully for ${studentId}.`);
            } else {
              const enrollError = enrollmentResult?.message || 'AWS Rekognition could not detect a clear face in the photo.';
              setError(enrollError);
              setNotice(`Student saved but face enrollment failed. ${enrollError}`);
            }
          }
        } catch (faceError) {
          const message = faceError instanceof Error ? faceError.message : 'Face sync failed, but the student was still saved.';
          setNotice(`Student saved for ${studentId}, but face sync could not complete. AWS Rekognition may not be configured. You can try again from the Sync All Face Photos button.`);
          setError(message);
        }
      }

      if (!notice) {
        setNotice(`Student saved for ${studentId}.`);
      }

      await loadStudents();
      handleCancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : (editingIndex ? 'Failed to update student.' : 'Failed to add student.'));
    }
    setLoading(false);
  };

  const handleEdit = (student: any) => {
    setEditingIndex(student.index);
    setForm(student);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setForm({ index: '', name: '', programme: '', level: '', photo: '' });
  };

  const handleDelete = async (index: string) => {
    setNotice('');
    if (window.confirm(`Are you sure you want to delete student ${index}?`)) {
      try {
        await deleteStudent(index);
        await loadStudents();
      } catch {
        setError('Failed to delete student.');
      }
    }
  };

  const handleBulkDelete = async () => {
    setNotice('');
    if (window.confirm(`Are you sure you want to delete ${selectedIndices.size} students?`)) {
      setLoading(true);
      try {
        for (const index of Array.from(selectedIndices)) {
          await deleteStudent(index);
        }
        await loadStudents();
        setSelectedIndices(new Set());
      } catch {
        setError('Failed to delete some students.');
      }
      setLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIndices(new Set(filteredStudents.map(s => s.index)));
    } else {
      setSelectedIndices(new Set());
    }
  };

  const handleSelect = (index: string) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
  };

  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.index.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStudents = filteredStudents.slice(indexOfFirstItem, indexOfLastItem);

  const handleExport = async () => {
    const XLSX = await import('xlsx');
    const rows = students.map(s => ({
      'Index': s.index,
      'Name': s.name,
      'Programme': s.programme,
      'Level': s.level,
      'Fingerprint': s.fingerprintEnrolled ? 'Yes' : 'Pending',
      'Face Enrolled': s.faceEnrolled ? 'Yes' : 'No',
      'Has Photo': s.photo ? 'Yes' : 'No',
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Students');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'students_export.xlsx';
    link.click();
  };

  const extractBase64Payload = (dataUrl: string) => {
    if (!dataUrl) {
      return null;
    }

    const parts = dataUrl.split(',');
    if (parts.length >= 2 && parts[1]) {
      return parts[1];
    }

    const normalized = dataUrl.trim();
    return normalized.length > 0 ? normalized : null;
  };

  const ensureCollectionReady = async () => {
    const status = await getRekognitionCollectionStatus();
    if (!status?.configured) {
      throw new Error(status?.message || 'AWS Rekognition is not configured on the backend.');
    }
    if (status?.exists) {
      return;
    }
    await initializeRekognitionCollection();
  };

  const handleSyncAllFaces = async () => {
    setError('');
    setNotice('');
    setSyncingAllFaces(true);

    const studentsWithPhotos = students.filter((student) => typeof student?.photo === 'string' && student.photo.length > 0);
    if (studentsWithPhotos.length === 0) {
      setSyncingAllFaces(false);
      setNotice('No students with profile photos found for face synchronization.');
      return;
    }

    let synced = 0;
    let skippedAsDuplicate = 0;
    let failed = 0;
    const failedIds: string[] = [];
    const duplicateIds: string[] = [];

    try {
      await ensureCollectionReady();
    } catch (err) {
      setSyncingAllFaces(false);
      setError(err instanceof Error ? err.message : 'Failed to initialize Rekognition collection.');
      setNotice('Bulk face sync was skipped because AWS Rekognition is not available on the backend.');
      return;
    }

    for (const student of studentsWithPhotos) {
      const studentId = typeof student?.index === 'string' ? student.index.trim() : '';
      const imageBase64 = extractBase64Payload(student.photo);

      if (!studentId || !imageBase64) {
        failed += 1;
        if (studentId) {
          failedIds.push(studentId);
        }
        continue;
      }

      try {
        // Check if this face already belongs to a different student
        const duplicateCheck = await checkDuplicateFaceEnrollment(imageBase64, studentId);
        if (duplicateCheck.isDuplicate) {
          skippedAsDuplicate += 1;
          duplicateIds.push(studentId);
          continue;
        }

        const enrollmentResult = await enrollFaceToRekognitionCollection({ imageBase64, studentId });
        // Only mark as faceEnrolled if enrollment actually succeeded (face detected and indexed)
        const enrollmentSucceeded = enrollmentResult?.enrolled === true;
        await addStudent({ ...student, faceEnrolled: enrollmentSucceeded });
        if (enrollmentSucceeded) {
          synced += 1;
        } else {
          failed += 1;
          failedIds.push(studentId);
        }
      } catch {
        failed += 1;
        failedIds.push(studentId);
      }
    }

    await loadStudents();
    const parts: string[] = [];
    if (synced > 0) parts.push(`${synced} synced`);
    if (skippedAsDuplicate > 0) parts.push(`${skippedAsDuplicate} skipped (duplicate face)`);
    if (failed > 0) parts.push(`${failed} failed`);
    setNotice(`Bulk face sync completed: ${parts.join(', ')}.`);

    if (failed > 0) {
      setError(`Face sync failed for: ${failedIds.slice(0, 10).join(', ')}${failedIds.length > 10 ? ' ...' : ''}`);
    }
    if (skippedAsDuplicate > 0) {
      console.warn(`Duplicate faces skipped for: ${duplicateIds.join(', ')}`);
    }
    setSyncingAllFaces(false);
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 68px)',
      width: '100%',
      backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #C9A84C 50%, #0f766e 100%)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ margin: 0, color: '#fff', fontSize: '2.25rem', textShadow: '1px 1px 3px rgba(0,0,0,0.7)' }}>Student Management</h1>
            <p style={{ margin: '0.5rem 0 0', color: '#eee', textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}>Add, edit, and view student information. Face sync now uses each student profile photo automatically.</p>
          </div>
        </div>

        <div style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.9)', 
          borderRadius: '12px', 
          padding: '2rem', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          marginBottom: '2rem',
          backdropFilter: 'blur(5px)',
          borderTop: '4px solid #C9A84C'
        }}>
          <h3 style={{ marginTop: 0, color: '#1F2937', fontSize: '1.5rem', marginBottom: '1.5rem' }}>
            {editingIndex ? `Editing Student: ${editingIndex}` : 'Add New Student'}
          </h3>
          <form style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', alignItems: 'flex-end' }} onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="index" style={{ marginBottom: '0.5rem', color: '#374151' }}>Index Number</label>
              <input id="index" name="index" type="text" placeholder="e.g., 1089..." value={form.index} onChange={handleChange} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #D1D5DB' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="photo" style={{ marginBottom: '0.5rem', color: '#374151' }}>Profile Photo</label>
              <input id="photo" name="photo" type="file" accept="image/*" onChange={handleImageChange} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #D1D5DB', background: 'white' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="name" style={{ marginBottom: '0.5rem', color: '#374151' }}>Full Name</label>
              <input id="name" name="name" type="text" placeholder="e.g., John Doe" value={form.name} onChange={handleChange} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #D1D5DB' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="programme" style={{ marginBottom: '0.5rem', color: '#374151' }}>Programme</label>
              <input id="programme" name="programme" type="text" placeholder="e.g., B.Sc. Computer Science" value={form.programme} onChange={handleChange} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #D1D5DB' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="level" style={{ marginBottom: '0.5rem', color: '#374151' }}>Level</label>
              <input id="level" name="level" type="text" placeholder="e.g., 400" value={form.level} onChange={handleChange} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #D1D5DB' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={loading} style={{
                background: '#C9A84C',
                color: '#1a1a1a',
                border: 'none',
                borderRadius: '8px',
                padding: '0.85rem 1.5rem',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
                height: 'fit-content',
                flex: 1
              }}>
                {loading ? (editingIndex ? 'Updating...' : 'Adding...') : (editingIndex ? 'Update Student' : '+ Add Student')}
              </button>
              {editingIndex && (
                <button type="button" onClick={handleCancelEdit} style={{
                  background: '#6B7280',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  fontWeight: 600,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  height: 'fit-content'
                }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
          {error && <div style={{ color: '#EF4444', marginTop: '1rem', background: '#FEF2F2', padding: '0.75rem', borderRadius: '8px' }}>{error}</div>}
          {notice && <div style={{ color: '#065F46', marginTop: '1rem', background: '#ECFDF5', padding: '0.75rem', borderRadius: '8px' }}>{notice}</div>}
        </div>

        <div style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
          borderRadius: '12px', 
          padding: '2rem', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          overflowX: 'auto',
          backdropFilter: 'blur(5px)',
          borderTop: '4px solid #C9A84C'
        }}>
          <h3 style={{ marginTop: 0, color: '#1F2937', fontSize: '1.5rem', marginBottom: '1.5rem' }}>Registered Students</h3>
          
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
            <input 
              type="text" 
              placeholder="Search by name or index number..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #D1D5DB' }}
            />
            <button
              onClick={handleSyncAllFaces}
              disabled={syncingAllFaces}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#C9A84C',
                color: '#1a1a1a',
                border: 'none',
                borderRadius: '8px',
                cursor: syncingAllFaces ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                opacity: syncingAllFaces ? 0.75 : 1
              }}
            >
              {syncingAllFaces ? 'Syncing Faces...' : 'Sync All Face Photos'}
            </button>
            {selectedIndices.size > 0 && (
              <button onClick={handleBulkDelete} style={{ padding: '0.75rem 1.5rem', background: '#EF4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Delete Selected ({selectedIndices.size})
              </button>
            )}
            <button onClick={handleExport} style={{ padding: '0.75rem 1.5rem', background: '#C9A84C', color: '#1a1a1a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>Export Excel</button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ padding: '0.75rem 1rem', width: '40px' }}>
                  <input type="checkbox" onChange={handleSelectAll} checked={filteredStudents.length > 0 && selectedIndices.size === filteredStudents.length} />
                </th>
                <th style={{ padding: '0.75rem 1rem', color: '#6B7280', fontWeight: 600, textAlign: 'left', width: '60px' }}>Photo</th>
                <th style={{ padding: '0.75rem 1rem', color: '#6B7280', fontWeight: 600, textAlign: 'left' }}>Index</th>
                <th style={{ padding: '0.75rem 1rem', color: '#6B7280', fontWeight: 600, textAlign: 'left' }}>Name</th>
                <th style={{ padding: '0.75rem 1rem', color: '#6B7280', fontWeight: 600, textAlign: 'left' }}>Programme</th>
                <th style={{ padding: '0.75rem 1rem', color: '#6B7280', fontWeight: 600, textAlign: 'left' }}>Level</th>
                <th style={{ padding: '0.75rem 1rem', color: '#6B7280', fontWeight: 600, textAlign: 'left' }}>Fingerprint</th>
                <th style={{ padding: '0.75rem 1rem', color: '#6B7280', fontWeight: 600, textAlign: 'left' }}>Face Recognition</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6B7280', fontWeight: 600, textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentStudents.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <input type="checkbox" checked={selectedIndices.has(s.index)} onChange={() => handleSelect(s.index)} />
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {s.photo ? (
                      <img src={s.photo} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '0.75rem' }}>N/A</div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>{s.index}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>{s.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>{s.programme}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>{s.level}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      backgroundColor: s.fingerprintEnrolled ? '#D1FAE5' : '#F3F4F6',
                      color: s.fingerprintEnrolled ? '#065F46' : '#6B7280'
                    }}>
                      {s.fingerprintEnrolled ? 'Yes' : 'Pending'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      backgroundColor: s.faceEnrolled ? '#D1FAE5' : '#FEF3C7',
                      color: s.faceEnrolled ? '#065F46' : '#92400E'
                    }}>
                      {s.faceEnrolled ? 'Enrolled' : 'Pending'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => setViewStudent(s)}
                      style={{
                        background: '#FFF9EB',
                        color: '#A68A2E',
                        border: '1px solid #C9A84C',
                        borderRadius: '6px',
                        padding: '0.25rem 0.75rem',
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      View
                    </button>
                    <button 
                      onClick={() => handleEdit(s)}
                      style={{
                        background: '#FFF9EB',
                        color: '#A68A2E',
                        border: '1px solid #C9A84C',
                        borderRadius: '6px',
                        padding: '0.25rem 0.75rem',
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(s.index)}
                      style={{
                        background: '#FEF2F2',
                        color: '#DC2626',
                        border: '1px solid #FCA5A5',
                        borderRadius: '6px',
                        padding: '0.25rem 0.75rem',
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {filteredStudents.length > itemsPerPage && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{ padding: '0.5rem 1rem', border: '1px solid #D1D5DB', borderRadius: '6px', background: currentPage === 1 ? '#F3F4F6' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >Previous</button>
              <span style={{ padding: '0.5rem 1rem', fontWeight: 600 }}>Page {currentPage}</span>
              <button 
                onClick={() => setCurrentPage(prev => (indexOfLastItem < filteredStudents.length ? prev + 1 : prev))}
                disabled={indexOfLastItem >= filteredStudents.length}
                style={{ padding: '0.5rem 1rem', border: '1px solid #D1D5DB', borderRadius: '6px', background: indexOfLastItem >= filteredStudents.length ? '#F3F4F6' : 'white', cursor: indexOfLastItem >= filteredStudents.length ? 'not-allowed' : 'pointer' }}
              >Next</button>
            </div>
          )}
        </div>

        {/* View Details Modal */}
        {viewStudent && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }} onClick={() => setViewStudent(null)}>
            <div style={{
              backgroundColor: 'white', padding: '2rem', borderRadius: '12px', maxWidth: '500px', width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              position: 'relative'
            }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setViewStudent(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6B7280' }}>&times;</button>
              
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                {viewStudent.photo ? (
                  <img src={viewStudent.photo} alt={viewStudent.name} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #E5E7EB' }} />
                ) : (
                  <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '3rem', color: '#9CA3AF' }}>?</div>
                )}
                <h2 style={{ margin: '1rem 0 0.5rem', color: '#111827' }}>{viewStudent.name}</h2>
                <p style={{ margin: 0, color: '#6B7280', fontWeight: 500 }}>{viewStudent.index}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#F9FAFB', padding: '1.5rem', borderRadius: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>Programme</label>
                  <div style={{ fontWeight: 600, color: '#374151' }}>{viewStudent.programme}</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>Level</label>
                  <div style={{ fontWeight: 600, color: '#374151' }}>{viewStudent.level}</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>Fingerprint</label>
                  <div style={{ fontWeight: 600, color: viewStudent.fingerprintEnrolled ? '#059669' : '#D97706' }}>
                    {viewStudent.fingerprintEnrolled ? 'Yes' : 'Pending'}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>Face Recognition</label>
                  <div style={{ fontWeight: 600, color: viewStudent.faceEnrolled ? '#059669' : '#D97706' }}>
                    {viewStudent.faceEnrolled ? 'Enrolled' : 'Not Enrolled'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentManagementPage;