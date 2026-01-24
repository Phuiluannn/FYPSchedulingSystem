import React, { createContext, useContext, useState } from 'react';
import {
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography
} from '@mui/material';

const AlertContext = createContext();

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export const AlertProvider = ({ children }) => {
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info',
    autoHideDuration: 6000
  });

  const [dialog, setDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null,
    showCancel: true
  });

  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });

  const showAlert = (message, severity = 'info', autoHideDuration = 6000) => {
    setSnackbar({
      open: true,
      message,
      severity,
      autoHideDuration
    });
  };

  const showConfirm = (message, title = 'Confirm') => {
    const currentScrollPosition = {
      x: window.pageXOffset || document.documentElement.scrollLeft,
      y: window.pageYOffset || document.documentElement.scrollTop
    };
    setScrollPosition(currentScrollPosition);

    return new Promise((resolve) => {
      setDialog({
        open: true,
        title,
        message,
        onConfirm: () => {
          setDialog(prev => ({ ...prev, open: false }));
          setTimeout(() => {
            window.scrollTo(currentScrollPosition.x, currentScrollPosition.y);
          }, 0);
          resolve(true);
        },
        onCancel: () => {
          setDialog(prev => ({ ...prev, open: false }));
          setTimeout(() => {
            window.scrollTo(currentScrollPosition.x, currentScrollPosition.y);
          }, 0);
          resolve(false);
        },
        showCancel: true
      });
    });
  };

  const closeSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const closeDialog = () => {
    setDialog(prev => ({ ...prev, open: false }));
    setTimeout(() => {
      window.scrollTo(scrollPosition.x, scrollPosition.y);
    }, 0);
  };

  const value = {
    showAlert,
    showConfirm,
    closeSnackbar,
    closeDialog
  };

  return (
    <AlertContext.Provider value={value}>
      {children}
      
      {/* Global Alert Components */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.autoHideDuration}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={closeSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={dialog.open}
        onClose={dialog.onCancel}
        maxWidth="sm"
        fullWidth
        disableScrollLock={true}
        disableRestoreFocus={true}
        disableEnforceFocus={true}
        keepMounted={false}
      >
        <DialogTitle>{dialog.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>
            {dialog.message}
          </Typography>
        </DialogContent>
        <DialogActions>
          {dialog.showCancel && (
            <Button onClick={dialog.onCancel} color="inherit">
              Cancel
            </Button>
          )}
          <Button onClick={dialog.onConfirm} color="primary" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </AlertContext.Provider>
  );
};