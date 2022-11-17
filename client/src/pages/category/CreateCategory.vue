<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%" elevation=5>
    <Toolbar title="Kategorie erstellen" back >
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
      <CategoryForm
        :category="category"
        @valid="onValid"
        action="create"
        showGroups
      />
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '@/router'
import CategoryForm from '@/components/category/CategoryForm'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  components: { CategoryForm, Toolbar, ToolbarButton },
  data() {
    return {
      category: {},
      valid: false,
      loading: false
    }
  },
  methods: {
    onValid (valid) {
      this.valid = valid;
    },
    save: function () {
      this.loading = true;
      var post = {...this.category};
      post.color = post.color.substr(1)
      post.text_color = post.text_color.substr(1)
      post.groups = post.groupsPopulated.map(g => g.cn);
      axios.post('/api/category/create', post)
        .then(response => {
          this.$snackbar.success(response.data.message)
          this.loading = false;
          router.push('/category/list')
        })
        .catch(error => {this.loading=false;})
    }
  },
  created() {
    this.category = {
      color: '#' + (0x1000000+Math.random()*0xffffff).toString(16).substr(1,6).toUpperCase(), // random color
      text_color: '#' + (0x1000000+Math.random()*0xffffff).toString(16).substr(1,6).toUpperCase(), // random color
      groups: [] }
  }
}
</script>