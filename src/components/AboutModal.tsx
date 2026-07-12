import { Modal, Typography } from "antd";
import { OpsetteFooterLogo } from "@/components/opsette-share";

const { Paragraph, Title } = Typography;

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutModal({ open, onClose }: AboutModalProps) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} title="About File Builder">
      <Title level={5} style={{ marginTop: 0 }}>A file workshop from Opsette</Title>
      <Paragraph>
        File Builder packages a finished client brand kit into one clean,
        labeled ZIP you can hand off. Drop each asset into its slot, name the
        brand, and download a tidy folder that looks professional out of the box.
      </Paragraph>
      <Paragraph>
        It also handles everyday file work: compress an image, convert between
        PNG, JPG, and WebP, resize to a target size, and more over time. Every
        job runs in your browser, so nothing you touch is uploaded anywhere.
      </Paragraph>
      <OpsetteFooterLogo />
    </Modal>
  );
}
