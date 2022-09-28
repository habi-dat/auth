const snackbarPlugin = {
  install: (Vue, { store }) => {
    if (!store) {
      throw new Error('Please provide vuex store.');
    }

    Vue.prototype.$snackbar = {
      success: function (content = '', timeout = 3000) {
        store.commit(
          'showMessage',
          { title: 'OK', content, color: 'success' , icon: 'check_circle',  timeout: timeout},
          { root: true }
        );
      },
      warning: function (content = '', timeout = -1) {
        store.commit(
          'showMessage',
          { title: 'Achtung', content, color: 'warning' , icon: 'warning',  timeout: timeout},
          { root: true }
        );
      },
      error: function (
        content = ''
      ) {
        store.commit(
          'showMessage',
          { title: 'Fehler', content, color: 'error' , icon: 'error',  timeout: -1},
          { root: true }
        );
      },
      info: function (
        content = ''
      ) {
        store.commit(
          'showMessage',
          { title: 'Info', content, color: 'info' , icon: 'info',  timeout: 3000},
          { root: true }
        );
      }
    };
  },
};
export default snackbarPlugin;