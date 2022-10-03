<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%">
    <Toolbar :title="'Account ' + user.cn + ' bearbeiten'" back >
      <template #right>
        <ToolbarButton
          icon="save"
          tooltip="Speichern"
          color="success"
          :loading="loading"
          @click="save"
          :disabled="!valid"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text style="height: 100%; overflow: hidden;">
      <UserForm
        v-if="loaded"
        :user="user"
        @valid="onValid"
        action="updateUser"
        showGroups
        allowMail
        allowDescription
        :onlyGroups="!$store.state.user.isAdmin"
      />
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '@/router'
import UserForm from '@/components/user/UserForm'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  components: { UserForm, Toolbar, ToolbarButton },
  data() {
    return {
      user: {},
      valid: true,
      loaded: false,
      loading: false
    }
  },
  methods: {
    getUser: function () {
      return axios.get('/api/user/' +  this.$route.query.dn)
        .then(response => {
          this.user = response.data.user;
          this.loaded = true
          return;
        })
        .catch(error => {})
    },
    onValid (valid) {
      this.valid = valid;
    },
    save: function () {
      this.loading = true;
      this.user.member = this.user.memberGroups.map(g => g.dn);
      this.user.owner = this.user.ownerGroups.map(g => g.dn);
      var endpoint = '/api/user/update';
      if (!this.$store.state.user.isAdmin) {
        endpoint = '/api/user/updategroups'
        this.user.member = this.user.member.filter(dn => this.$store.state.user.owner.includes(dn))
        this.user.owner = this.user.owner.filter(dn => this.$store.state.user.owner.includes(dn))
      }
      axios.post(endpoint, this.user)
        .then(response => {
          this.loading = false;
          this.$snackbar.success('Account ' + this.user.cn + ' geändert')
          if (this.$store.state.user.dn === response.data.user.dn) {
            this.$store.state.user = response.data.user;
          }
          router.push('/user/list')
        })
        .catch(errors => {
          this.loading = false;
        })
    }
  },
  async created() {
    await this.getUser();
  }
}
</script>