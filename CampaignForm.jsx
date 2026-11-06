import React from "react";

export default function CampaignForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  error,
  busy,
}) {
  return (
    <form className="create-form" onSubmit={onSubmit}>
      <div className="campaign-form-heading">
        <h3>Create a project for the community.</h3>
        <button className="admin-back-link" type="button" onClick={onCancel}>Cancel</button>
      </div>
      {error && <div className="feedback feedback-error" role="alert">{error}</div>}
      <div className="form-grid">
        <label>Project name<input required maxLength="80" value={form.title} onChange={(event) => onChange("title", event.target.value)} placeholder="e.g. Solar-powered community kitchen" /></label>
        <label>Goal in ETH<input required type="number" min="0.000000000000000001" step="any" value={form.goal} onChange={(event) => onChange("goal", event.target.value)} placeholder="10" /></label>
        <label>Campaign length in days<input required type="number" min="1" max="365" value={form.duration} onChange={(event) => onChange("duration", event.target.value)} /></label>
        <label>Milestones, separated by commas<input required value={form.milestones} onChange={(event) => onChange("milestones", event.target.value)} placeholder="Research, First prototype, Final delivery" /></label>
        <label className="form-full">What are you building?<textarea required maxLength="500" rows="3" value={form.description} onChange={(event) => onChange("description", event.target.value)} placeholder="Tell the community why this project matters." /></label>
      </div>
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish project"}</button>
    </form>
  );
}
