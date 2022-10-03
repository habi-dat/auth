<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%">
    <Toolbar title="Accounts" icon="group" search :searchText.sync="search">
      <template #right>
        <ToolbarButton
          icon="edit"
          tooltip="Account bearbeiten"
          color="info"
          @click="updateUser"
          :disabled="selectedUsers.length === 0"
        />
        <ToolbarButton
          v-if="$store.state.user.isAdmin"
          icon="lock"
          tooltip="Passwort ändern"
          color="info"
          @click="changePassword"
          :disabled="selectedUsers.length === 0"
        />
        <ToolbarButton
          icon="delete"
          tooltip="Account löschen"
          :loading="loading"
          color="error"
          @click="deleteUser"
          :disabled="selectedUsers.length === 0"
        />
        <ToolbarButton
          icon="add"
          tooltip="Account erstellen"
          color="success"
          to="/user/create"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text style="height:100%;overflow: hidden;">
      <UserTable
        v-if="usersLoaded"
        :users="users"
        :search="search"
        @selectionChanged="onSelectionChanged"
        @onGridReady="onGridReadyHandler"
        showGroups
        rowSelection="single"/>
    </v-card-text>
    <ConfirmDialog ref="confirm" />
  </v-card>
</template>

<script>

import axios from 'axios'
import router from '@/router'
import UserTable from '@/components/user/UserTable'
import ConfirmDialog from '@/components/ConfirmDialog'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'
export default {
  components: {UserTable, ConfirmDialog, Toolbar, ToolbarButton},
  data() {
    return {
      users: [],
      selectedUsers: [],
      usersLoaded: false,
      loading: false,
      search: '',
      gridApi: null
    }
  },
  methods: {
    onGridReadyHandler(params) {
        this.gridApi = params.api;
    },
    onSelectionChanged: function(selectedRows) {
      this.selectedUsers = selectedRows;
    },
    async deleteUser() {

      var user = this.selectedUsers[0];
      if (await this.$refs.confirm.open('Bist du sicher?','Willst du den Account ' + user.cn + ' wirklich löschen?')) {
        this.loading = true;
        axios.delete('/api/user/delete/' + user.dn)
          .then(response => {
            this.loading = false;
            if (response.data.status === 'success') {
              this.$snackbar.success(response.data.message)
            } else {
              this.$snackbar.warning(response.data.message)
            }
            this.gridApi.applyTransaction({ remove: [user]});
          })
          .catch(e => {
            this.loading = false;
          })

      }
    },
    updateUser() {
      router.push('/user/update?dn=' + this.selectedUsers[0].dn)
    },
    changePassword() {
      router.push('/user/password?dn=' + this.selectedUsers[0].dn)
    },
    getUsers: function () {
      var self = this;
      axios.get('/api/users')
        .then(response => {
          self.users = response.data.users;
          self.usersLoaded = true;
        })
        .catch(e => {});
    }
  },
  async created() {
    this.getUsers();
  }
}
</script>