<template>

  <v-card outlined class="d-inline-block" width="800">
    <Toolbar title="Profil bearbeiten" back>
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
    <v-card-text>
        <UserForm :user="user" @valid="valid => { this.valid = valid}" action="editProfile" />
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '../../router'
import UserForm from '@/components/user/UserForm'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  components: { UserForm, Toolbar, ToolbarButton },
  data() {
    return {
      user: {},
      valid: true,
      loading: false
    }
  },
  methods: {
    save: function () {
      this.loading = true;
      axios.post('/api/user/profile', this.user)
        .then(response => {
          this.loading = false;
          this.$store.state.config.authenticated = true
          this.$store.state.user = response.data.user
          this.$snackbar.success('Profil gespeichert')
          router.push('/')
        })
        .catch(errors => {
          this.loading = false;
        })

    }
  },
  created() {
    this.user = { ...this.$store.state.user }
  }
}
</script>